

class Barchart {
    /**
     * Class constructor with basic chart configuration
     * @param {Object} _config - chart config (parent, margins, axes names, etc.)
     * @param {Array} _actualData - dataset for actual values
     * @param {Array} _predictedData - dataset for projected/fallback values
     */

    constructor(_config, _actualData, _predictedData) {
        const parent = document.querySelector(_config.parentElement);
        this.config = {
            xAxisName: _config.xAxisName || 'Entity',
            yAxisName: _config.yAxisName || 'Value',
            groupColumn: _config.groupColumn || 'Entity',   // x-axis categories
            codeColumn: _config.codeColumn || 'Code',       // for flags or IDs
            yearColumn: _config.yearColumn || 'Year',       // year column
            actualColumn: _config.actualColumn,
            projectedColumn: _config.projectedColumn,
            parentElement: _config.parentElement,
            colorScale: _config.colorScale,
            margin: _config.margin || { top: 25, right: 20, bottom: 20, left: 35 },
            tooltipPadding: _config.tooltipPadding || 15
        };
        this.actualData = _actualData || [];
        this.predictedData = _predictedData || [];
        this.data = [...this.actualData, ...this.predictedData]; // combined for year extraction
        this.years = [];
        this.currentYearIndex = 0;
        this.isPlaying = false;
        this.animationInterval = null;
        this.initVis();
    }

    formatNumber(value) {
    if (!isFinite(value)) return 'N/A';
    const absVal = Math.abs(value);
    if (absVal >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (absVal >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (absVal >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return value.toString();
}


    /**
     * Initialize scales/axes and append static elements
     */
    initVis() {
        
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.svg = d3.select(vis.config.parentElement)
            .style('width', '100%')
            .style('height', '100%');

        vis.width = parseInt(vis.svg.style('width')) - vis.config.margin.left - vis.config.margin.right;
        vis.height = parseInt(vis.svg.style('height')) - vis.config.margin.top - vis.config.margin.bottom;

        vis.xScale = d3.scaleBand()
            .padding(0.1)
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale);
        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(6)
            .tickSize(-vis.width - 10)
            .tickPadding(10)
            .tickFormat(d => vis.formatNumber(d));


        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', 300);

        // Append group element that will contain our actual chart 
        // and position it according to the given margin config
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Append x-axis group and move it to the bottom of the chart
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        // Append y-axis group
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        // Append axis titles
        vis.chart.append('text')
            .attr('class', 'axis-title')
            .attr('y', vis.height - 60)
            .attr('x', vis.width + 10)
            .attr('dy', '.71em')
            .style('text-anchor', 'end')

        vis.chart.append('text')
            .attr('class', 'axis-title')
            .attr('transform', `rotate(-90)`)
            .attr('x', -vis.height / 0.45)
            .attr('y', -vis.config.margin.left + 12)
            .style('text-anchor', 'middle')
            .text(vis.config.yAxisName);

        // Create year selector controls
        vis.initYearControls();
        vis.resize();
    }

    /**
     * Initialize year selector controls (play/pause, slider, year display)
     */
    initYearControls() {
        let vis = this;
    // ✅ REMOVE old controls first
    const oldControls = document.getElementById('year-controls');
    if (oldControls) oldControls.remove();

    vis.years = vis.getYears();
    if (vis.years.length === 0) return;

        // Create container for controls
        const controlsDiv = document.createElement('div');
        controlsDiv.id = 'year-controls';
        controlsDiv.style.cssText = `
    margin: 10px 0;
    display: flex;
    align-items: center;
    gap: 10px;
    width: ${vis.config.containerWidth}px; /* match chart width */
  `;

        // Play/Pause button
        const playBtn = document.createElement('button');
        playBtn.id = 'scroll-play-btn';
        playBtn.textContent = 'Play';
        playBtn.onclick = () => vis.togglePlay();
        controlsDiv.appendChild(playBtn);

        // Year slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = 'year-slider';
        slider.min = 0;
        slider.max = vis.years.length - 1;
        slider.value = 0;
        slider.style.cssText = 'flex: 1; cursor: pointer;';
        slider.oninput = (e) => vis.updateYear(+e.target.value);
        controlsDiv.appendChild(slider);

        // Year display
        const yearDisplay = document.createElement('span');
        yearDisplay.id = 'year-display';
        yearDisplay.textContent = vis.years[0];
        yearDisplay.style.cssText = 'min-width: 60px; text-align: center; font-weight: bold;';
        controlsDiv.appendChild(yearDisplay);

        // Append **after the chart container** (not before)
        const parentElem = document.querySelector(vis.config.parentElement);
        if (parentElem && parentElem.parentNode) {
            parentElem.parentNode.insertBefore(controlsDiv, parentElem.nextSibling);
        }

        const initialYear = vis.years[0];
        if (initialYear !== undefined && initialYear !== null) {
            vis.updateYear(0); // pass the index of the first year
        }
    }


    /**
     * Update barchart for a specific year index
     */
    updateYear(index) {
        let vis = this;
        vis.currentYearIndex = index;
        const year = vis.years[index];
        if (document.getElementById('year-display')) {
            document.getElementById('year-display').textContent = year;
        }
        if (document.getElementById('scroll-play-btn')) {
            document.getElementById('scroll-play-btn').value = index;
        }
        vis.updateVis(null, year);
    }

    /**
     * Toggle play/pause animation
     */
    togglePlay() {
        let vis = this;
        vis.isPlaying = !vis.isPlaying;
        const playBtn = document.getElementById('scroll-play-btn');
        if (playBtn) {
            playBtn.textContent = vis.isPlaying ? 'Pause' : 'Play';
        }

        if (vis.isPlaying) {
            vis.animationInterval = setInterval(() => {
                vis.currentYearIndex = (vis.currentYearIndex + 1) % vis.years.length;
                vis.updateYear(vis.currentYearIndex);
            }, 500); // 500ms per year
        } else {
            clearInterval(vis.animationInterval);
        }
    }

    resize() {
        let vis = this;

        const parent = document.querySelector(vis.config.parentElement);
        vis.config.containerWidth = parent.clientWidth;
        vis.config.containerHeight = parent.clientHeight;

        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        vis.chart.attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.xScale = d3.scaleBand().range([0, vis.width]).padding(0.1);
        vis.yScale = d3.scaleLinear().range([vis.height, 0]);

        vis.xAxis = d3.axisBottom(vis.xScale);
        vis.yAxis = d3.axisLeft(vis.yScale)
    .ticks(6)
    .tickSize(-vis.width - 10)
    .tickPadding(0)
    .tickFormat(d => vis.formatNumber(d));  // ✅ add this


        // Position axes
        vis.xAxisG.attr('transform', `translate(0,${vis.height})`);
        vis.chart.select('.x-title').attr('x', vis.width / 2).attr('y', vis.height + vis.config.margin.bottom - 4);
        vis.chart.select('.y-title').attr('x', -vis.height / 2).attr('y', -vis.config.margin.left + 12);
    }


    /**
     * Get all unique years from the data
     */
    getYears() {
        let vis = this;
        if (!vis.data || !Array.isArray(vis.data)) return [];
        const yearValue = d => +d.year || +d.Year || NaN;
        const years = Array.from(new Set(vis.data.map(yearValue).filter(y => isFinite(y)))).sort((a, b) => a - b);
        return years;
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis(filteredData = null, year = null) {
        let vis = this;

        vis.displayData = filteredData || vis.data;
        if (!vis.displayData || !Array.isArray(vis.displayData)) return;

        // Accessors
        vis.colorValue = d => (d.code || d.Code || d.entity || d.Entity || '').toString().trim();

        vis.yValue = d => {
            const actualRaw = d[vis.config.actualColumn];
            const actual = actualRaw !== null && actualRaw !== undefined && actualRaw !== '' ? +actualRaw : NaN;

            const projectedRaw = d[vis.config.projectedColumn];
            const projected = projectedRaw !== null && projectedRaw !== undefined && projectedRaw !== '' ? +projectedRaw : NaN;

            return isFinite(actual) ? actual : projected;
        };


        vis.yearValue = d => +d.year || +d.Year || NaN;

        // Ensure years array is populated
        if (!vis.years || vis.years.length === 0) vis.years = vis.getYears();

        // Determine year to display
        if (year == null || !isFinite(year) || !vis.years.includes(year)) {
            year = vis.currentYear || (vis.years.length > 0 ? vis.years[0] : null);
        }
        if (!isFinite(year)) return;

        // Filter data for selected year
        const dataForYear = vis.displayData.filter(d => vis.yearValue(d) === year);
        if (dataForYear.length === 0) return;

        // Group by country/code using yValue
        const grouped = Array.from(
            d3.rollup(
                dataForYear,
                v => {
                    const row = v[0]; // take the first row
                    const actual = row[vis.config.actualColumn] !== undefined && row[vis.config.actualColumn] !== '' ? +row[vis.config.actualColumn] : NaN;
                    const projected = row[vis.config.projectedColumn] !== undefined && row[vis.config.projectedColumn] !== '' ? +row[vis.config.projectedColumn] : NaN;
                    const value = isFinite(actual) ? actual : projected;

                    return {
                        value,
                        actual,
                        projected,
                        country: row.country ?? row.Country ?? row.Entity ?? '',
                        code: row.code ?? row.Code ?? row.ISO3 ?? ''
                    };
                },
                d => vis.colorValue(d)
            ),
            ([key, data]) => ({ key, ...data, year })
        )
            .filter(d => isFinite(d.value))
            .sort((a, b) => b.value - a.value);


        // Update scales
        vis.xScale.domain(grouped.map(d => d.key));
        const yMin = d3.min(grouped, d => d.value);
        const yMax = d3.max(grouped, d => d.value);
        const yRange = (isFinite(yMax) && isFinite(yMin)) ? (yMax - yMin) : 0;

        // Compute padding. If all values equal or range is zero, use a small absolute padding.
        const pad = yRange > 0 ? yRange * 0.05 : (Math.abs(yMax) > 0 ? Math.abs(yMax) * 0.05 : 1);

        // Ensure the y-domain always includes zero so the zero baseline is visible
        let yDomainMin = (isFinite(yMin) ? yMin - pad : -pad);
        let yDomainMax = (isFinite(yMax) ? yMax + pad : pad);
        if (yDomainMin > 0) yDomainMin = 0;
        if (yDomainMax < 0) yDomainMax = 0;

        vis.yScale.domain([yDomainMin, yDomainMax]);

        vis.currentYear = year;
        vis.renderVis(grouped);

        // Update tooltip if hovering
        if (vis.hoveredBar) {
            const d = d3.select(vis.hoveredBar).datum();
            const flagUrl = getFlagUrl(d.code);

            let valueLabel = vis.config.actualColumn;
            let displayValue = d.actual;
            if (!isFinite(d.actual) && isFinite(d.projected)) {
                valueLabel = vis.config.projectedColumn;
                displayValue = d.projected;
            }

const valueDisplay = vis.formatNumber(displayValue);
            const yearText = isFinite(d.year) ? d.year : 'Unknown';

            d3.select('#tooltip')
                .style('display', 'block')
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
            <span style="font-weight: bold; font-size: 18px;">${d.country}</span>
            ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
        </div>
        <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>Year: ${yearText}</i></div>
        <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
            <li>${valueLabel}: <strong>${valueDisplay}</strong></li>
        </ul>
      `);
        }
    }

    /**
     * Bind data to visual elements.
     */
    renderVis(grouped) {
        let vis = this;

        // Add bars
        const bars = vis.chart.selectAll('.bar')
            .data(grouped, d => d.key)
            .join('rect')
            .attr('data-year', vis.currentYear)
            .attr('class', 'bar')
            .attr('x', d => vis.xScale(d.key))
            .attr('width', d => vis.xScale.bandwidth())
            .attr('y', d => {
                const yPos = vis.yScale(d.value);
                const y0 = vis.yScale(0);
                return d.value >= 0 ? yPos : y0;
            })
            .attr('height', d => {
                const yPos = vis.yScale(d.value);
                const y0 = vis.yScale(0);
                return Math.abs(yPos - y0);
            })
            .attr('fill', d => vis.config.colorScale ? vis.config.colorScale(d.key) : '#999');
const labels = vis.chart.selectAll('.label')
    .data(grouped)
    .join('text')
    .attr('class', 'label')
    .attr('x', d => vis.xScale(d.key) + vis.xScale.bandwidth() / 2)  // Center the label on the bar
    .attr('y', d => vis.yScale(d.value) + 50)  // Position the label slightly above the top of the bar (adjust based on bar height)
    .attr('text-anchor', 'middle')  // Center the text horizontally
    .attr('fill', 'white')  // White text color for better contrast
    .attr('font-size', '32px')  // Increase font size for better visibility
    .attr('font-weight', 'bold')  // Make the text bold
    .attr('stroke', 'black')  // Add a black stroke for contrast
    .attr('stroke-width', '2px')  // Define stroke width
    .text(d => d.key);  // Display the label (d.key or another property if needed)

        // Tooltip event listeners
        bars
            .on('mouseover', (event, d) => {
                vis.hoveredBar = event.currentTarget;

                // ===== Determine which value to show =====
                let valueLabel = vis.config.actualColumn;
                let displayValue = d.actual;

                if (!isFinite(d.actual) && isFinite(d.projected)) {
                    valueLabel = vis.config.projectedColumn;
                    displayValue = d.projected;
                }

const valueDisplay = vis.formatNumber(displayValue);
                const yearText = isFinite(d.year) ? d.year : 'Unknown';

                // ===== Flag =====
                const flagUrl = getFlagUrl(d.code || d.Code || d.country);

                // ===== Tooltip =====
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
            <span style="font-weight: bold; font-size: 18px;">${d.country}</span>
            ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
        </div>
        <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>Year: ${yearText}</i></div>
        <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
            <li>${valueLabel}: <strong>${valueDisplay}</strong></li>
        </ul>
      `);
            })



        // Add zero-line for reference
        vis.chart.selectAll('.zero-line').remove();
        if (vis.yScale(0) >= 0 && vis.yScale(0) <= vis.height) {
            vis.chart.append('line')
                .attr('class', 'zero-line')
                .attr('x1', 0)
                .attr('x2', vis.width)
                .attr('y1', vis.yScale(0))
                .attr('y2', vis.yScale(0))
                .attr('stroke', '#999')
                .attr('stroke-dasharray', '4')
                .attr('opacity', 0.5);
        }

        // Update the axes
        vis.xAxisG
            .call(vis.xAxis)
            .call(g => g.select('.domain').remove());

        vis.yAxisG
            .call(vis.yAxis)
            .call(g => g.select('.domain').remove());
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

