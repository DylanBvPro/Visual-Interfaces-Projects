class ChoroplethMap {

    /**
     * Class constructor with basic configuration
     * @param {Object} _config - configuration object
     * @param {Object} _data - GeoJSON data
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            valueProperty: _config.valueProperty || 'data', // property on feature.properties
            valueKey: _config.valueKey || 'actual', // which key inside that property to color by
            legendTitle: _config.legendTitle,
            entityColumn: _config.entityColumn || 'Entity',
            codeColumn: _config.codeColumn || 'Code',
            containerWidth: _config.containerWidth || 900,
            containerHeight: _config.containerHeight || 400,
            margin: _config.margin || { top: 0, right: 0, bottom: 0, left: 0 },
            tooltipPadding: 10,
            legendBottom: 50,
            legendLeft: 50,
            legendRectHeight: 12,
            legendRectWidth: 150
        }
    this.instanceId = `map-${Math.random().toString(36).substr(2, 9)}`;

        this.data = _data;
        this.years = [];
        this.currentYearIndex = 0;
        this.isPlaying = false;
        this.animationInterval = null;

        this.initVis();

    }

    initVis() {
        let vis = this;

        const parentEl = document.querySelector(vis.config.parentElement);
        vis.config.containerWidth = parentEl.clientWidth || vis.config.containerWidth;
        vis.config.containerHeight = parentEl.clientHeight || vis.config.containerHeight;

        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Responsive svg
        vis.svg = d3.select(vis.config.parentElement).append('svg')
            .attr('width', '100%')
            .attr('height', vis.config.containerHeight)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.projection = d3.geoMercator();
        vis.geoPath = d3.geoPath().projection(vis.projection);

        vis.colorScale = d3.scaleLinear()
            .range(['#cfe2f2', '#0d306b'])
            .interpolate(d3.interpolateHcl);

        vis.linearGradient = vis.svg.append('defs').append('linearGradient')
            .attr("id", "legend-gradient");

        vis.legend = vis.svg.append('g')
            .attr('class', 'legend');

        vis.legendRect = vis.legend.append('rect')
            .attr('width', vis.config.legendRectWidth)
            .attr('height', vis.config.legendRectHeight);

        vis.legendTitle = vis.legend.append('text')
            .attr('class', 'legend-title')
            .attr('dy', '.35em')
            .style('font-weight', '700')
            .attr('y', -10)
            .text(vis.config.legendTitle);

        vis.updateLegendPosition = function () {
            const parent = document.querySelector(vis.config.parentElement);
            vis.config.containerWidth = parent.clientWidth || vis.config.containerWidth;
            vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
            const legendX = Math.max(8, vis.width - vis.config.legendRectWidth - vis.config.legendLeft);
            const legendY = Math.max(8, vis.height - vis.config.legendBottom);
            vis.legend.attr('transform', `translate(${legendX + vis.config.margin.left},${legendY + vis.config.margin.top})`);
        };

        // Expose resize
        vis.resize = function () {
            const parent = document.querySelector(vis.config.parentElement);
            vis.config.containerWidth = parent.clientWidth || vis.config.containerWidth;
            vis.config.containerHeight = parent.clientHeight || vis.config.containerHeight;
            vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
            vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

            vis.svg.attr('height', vis.config.containerHeight);

            // Re-fit projection
            vis.projection.fitExtent(
                [[vis.config.margin.left + 5, vis.config.margin.top + 5],
                [vis.width - 5, vis.height - 5]],
                vis.data
            );

            vis.updateLegendPosition();
            vis.renderVis();
        };

        // Add automatic resize listener
        window.addEventListener('resize', () => {
            vis.resize();
        });

        vis.zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', (event) => {
                vis.chart.attr('transform', event.transform);
            });

        vis.svg.call(vis.zoom);

        vis.updateVis();
    }

    updateVis() {
        let vis = this;

        // Only apply initial zoom & centering the first time
        if (!vis.isInitialZoomDone) {
            const initialScale = 3; // 300%
            const centerX = vis.width / 2;
            const centerY = vis.height / 3.3;
            const initialTranslate = [
                centerX * (1 - initialScale),
                centerY * (1 - initialScale)
            ];

            vis.svg.call(
                vis.zoom.transform,
                d3.zoomIdentity.translate(initialTranslate[0], initialTranslate[1]).scale(initialScale)
            );

            vis.isInitialZoomDone = true; // mark that initial zoom has been applied
        }

        // Compute extent using the selected key inside the valueProperty object
        const valueExtent = d3.extent(vis.data.features, d => vis.getValueForFeature(d));

        vis.colorScale.domain(valueExtent);

        vis.legendStops = [
            { color: '#cfe2f2', value: valueExtent[0], offset: '0%' },
            { color: '#0d306b', value: valueExtent[1], offset: '100%' },
        ];

        if (vis.config.legendTitle) {
            vis.legendTitle.text(vis.config.legendTitle);
        }

        vis.renderVis();
    }


    /**
     * Helper to get the value for a feature for the current year (or static)
     */
    getValueForFeature(d) {
        let vis = this;
        const prop = d.properties[vis.config.valueProperty];
        console.log('Prop', prop);
        if (!prop) return null;

        // If years are provided, prop is expected to be a map: { 1990: { actual, projected }, ... }
        if (vis.years && vis.years.length > 0) {
            const year = vis.years[vis.currentYearIndex];
            const obj = prop[year];
            if (!obj) return null;
            const actualRaw = obj[vis.config.valueKey];
            const projectedRaw = obj.projected;
            const actual = actualRaw != null && actualRaw !== '' ? +actualRaw : NaN;
            const projected = projectedRaw != null && projectedRaw !== '' ? +projectedRaw : NaN;

            return Number.isFinite(actual) ? actual : (Number.isFinite(projected) ? projected : null);
        }

        // Fall back: prop might be a single object with direct keys (actual/projected)
        const actualRaw = prop[vis.config.valueKey];
        const projectedRaw = prop.projected;
        const actual = actualRaw != null && actualRaw !== '' ? +actualRaw : NaN;
        const projected = projectedRaw != null && projectedRaw !== '' ? +projectedRaw : NaN;

        return Number.isFinite(actual) ? actual : (Number.isFinite(projected) ? projected : null);
    }

    /**
     * Set list of years and create controls for playback
     */
    setYears(years) {
        let vis = this;
        if (!Array.isArray(years) || years.length === 0) return;
        vis.years = years.slice();
        vis.currentYearIndex = 0;
        vis.initYearControls();
        vis.updateVis();
    }

    initYearControls() {
        let vis = this;
        // Remove old controls if present
        const old = document.getElementById('map-year-controls');
        if (old) old.remove();

        if (!vis.years || vis.years.length === 0) return;

        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'map-year-controls';
        controlsDiv.style.cssText = `margin:8px 0; display:flex; gap:8px; align-items:center;`;

        const playBtn = document.createElement('button');
        playBtn.id = 'scroll-play-btn2';
        playBtn.textContent = 'Play';
        playBtn.onclick = () => vis.togglePlay();
        controlsDiv.appendChild(playBtn);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'year-slider2';
        slider.min = 0;
        slider.max = vis.years.length - 1;
        slider.value = vis.currentYearIndex;
        slider.style.cssText = 'flex:1;';
        slider.oninput = (e) => vis.updateYear(+e.target.value);
        controlsDiv.appendChild(slider);

        const yearDisplay = document.createElement('span');
        yearDisplay.id = 'year-display2';
        yearDisplay.textContent = vis.years[vis.currentYearIndex];
        yearDisplay.style.cssText = 'min-width:60px; text-align:center; font-weight:bold;';
        controlsDiv.appendChild(yearDisplay);

        const parentElem = document.querySelector(vis.config.parentElement);
        if (parentElem && parentElem.parentNode) {
            parentElem.parentNode.insertBefore(controlsDiv, parentElem.nextSibling);
        }
    }

    updateYear(index) {
        let vis = this;
        if (!vis.years || vis.years.length === 0) return;
        vis.currentYearIndex = index % vis.years.length;
        if (document.getElementById('year-display2')) document.getElementById('year-display2').textContent = vis.years[vis.currentYearIndex];
        if (document.getElementById('scroll-play-btn2')) document.getElementById('year-slider2').value = vis.currentYearIndex;
        vis.updateVis();
    }

    togglePlay() {
        let vis = this;
        vis.isPlaying = !vis.isPlaying;
        const btn = document.getElementById('scroll-play-btn2');
        if (btn) btn.textContent = vis.isPlaying ? 'Pause' : 'Play';

        if (vis.isPlaying) {
            vis.animationInterval = setInterval(() => {
                vis.currentYearIndex = (vis.currentYearIndex + 1) % vis.years.length;
                vis.updateYear(vis.currentYearIndex);
            }, 700);
        } else {
            clearInterval(vis.animationInterval);
        }
    }

    renderVis() {
        let vis = this;

        const countries = vis.data; // GeoJSON already has .features
        // Fit the projection using fitExtent with a small inset to reduce outer whitespace
        vis.projection.fitExtent([[vis.config.margin.left + 5, vis.config.margin.top + 5], [vis.width - 5, vis.height - 5]], countries);

        // Reposition legend after computing sizes
        if (vis.updateLegendPosition) vis.updateLegendPosition();

        const countryPath = vis.chart.selectAll('.country')
            .data(countries.features.filter(d => d.properties.name !== 'Antarctica')) // <-- filter out Antarctica
            .join('path')
            .attr('class', 'country')
            .attr('d', vis.geoPath)
            .attr('fill', d => {
                const v = vis.getValueForFeature(d);
                return (v || v === 0) ? vis.colorScale(v) : '#ccc'; // fallback color if no data
            });


        countryPath
            .on('mousemove', (event, d) => {
                const prop = d.properties[vis.config.valueProperty];

                // Get value for current year: prefer actual, fallback to projected
                let value = null;
                let isProjected = false;

                if (prop) {
                    const yearData = vis.years?.length > 0 ? prop[vis.years[vis.currentYearIndex]] : prop;
                    if (yearData) {
                        if (yearData[vis.config.valueKey] != null) {
                            value = +yearData[vis.config.valueKey]; // actual value
                        } else if (yearData.projected != null) {
                            value = +yearData.projected;           // fallback to projected
                            isProjected = true;
                        }
                    }
                }

                const valueLabel = (value != null)
                    ? `<strong>${value}</strong>` + (isProjected ? ' (Projected)' : '')
                    : 'No data available';

                const entityLabel = d.properties.name || 'Unknown';
                const yearLabel = vis.years?.[vis.currentYearIndex] || '';

                // Optional: resolve ISO3 code from common feature fields and get flag URL
                const iso3 = d.id || d.properties.ISO_A3 || d.properties.iso_a3 || d.properties.ISO3 || d.properties.iso3 || d.properties.Code || d.properties.code;
                const flagUrl = getFlagUrl(iso3);
                d3.select('#tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
                    .style('background-color', 'rgba(255,255,255,0.95)')
                    .style('border', '1px solid #ccc')
                    .style('border-radius', '8px')
                    .style('padding', '10px 15px')
                    .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
                    .style('font-family', 'Arial, sans-serif')
                    .style('font-size', '16px')
                    .style('color', '#333')
                    .html(`
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="font-weight: bold; font-size: 18px;">${entityLabel}</span>
          ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
        </div>
        <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>${yearLabel}</i></div>
        <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
          <li>${vis.config.legendTitle}: ${valueLabel}</li>
        </ul>
      `);
            })
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none');
            });




        vis.legend.selectAll('.legend-label')
            .data(vis.legendStops)
            .join('text')
            .attr('class', 'legend-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .attr('y', 20)
            .attr('x', (d, index) => index === 0 ? 0 : vis.config.legendRectWidth)
            .text(d => Math.round(d.value * 10) / 10);

        vis.linearGradient.selectAll('stop')
            .data(vis.legendStops)
            .join('stop')
            .attr('offset', d => d.offset)
            .attr('stop-color', d => d.color);

        vis.legendRect.attr('fill', 'url(#legend-gradient)');
    }
}

function getFlagUrl(countryCode) {
    // Check if getCountryISO2 is defined before calling
    if (typeof getCountryISO2 !== 'function') {
        console.warn('getCountryISO2 not loaded yet');
        return '';
    }
    const iso2 = getCountryISO2(countryCode);
    return iso2
        ? `https://flagcdn.com/64x48/${iso2.toLowerCase()}.png`
        : '';
}
