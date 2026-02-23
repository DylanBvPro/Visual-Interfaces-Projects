class Scatterplot {

    /**
     * Class constructor with basic chart configuration
     * @param {Object} _config
     * @param {Array} _actualData
     * @param {Array} _predictedData 
     */
    constructor(_config, _actualData, _predictedData) {
        const parent = document.querySelector(_config.parentElement);

        this.config = {
            parentElement: _config.parentElement,
            colorScale: _config.colorScale,
            xAxisName: _config.xAxisName || 'Year',
            yAxisName: _config.yAxisName || 'Value',
            groupColumn: _config.groupColumn || 'Entity',   // x-axis categories
            codeColumn: _config.codeColumn || 'Code',       // for flags or IDs
            yearColumn: _config.yearColumn || 'Year',       // year column
            actualColumn: _config.actualColumn,
            projectedColumn: _config.projectedColumn,
            xActualColumn: _config.xActualColumn || _config.yearColumn || 'Year',
            xProjectedColumn: _config.xProjectedColumn,
            isComparative: _config.isComparative || false,
            yearFilter: _config.yearFilter || null,
            rActualColumn: _config.rActualColumn || null,
            rProjectedColumn: _config.rProjectedColumn || null,
            rAxisName: _config.rAxisName || 'Radius',
            containerWidth: parent ? parent.clientWidth : (_config.containerWidth || 2000),
            containerHeight: parent ? parent.clientHeight : (_config.containerHeight || 300),
            margin: _config.margin || { top: 25, right: 20, bottom: 20, left: 35 },
            tooltipPadding: _config.tooltipPadding || 15
        };
        this.actualData = _actualData || [];
        this.predictedData = _predictedData || [];
        this.data = [...this.actualData, ...this.predictedData]; // combine for year extraction
        this.years = [];
        this.initVis();
    }

    formatNumber(value) {
    if (!isFinite(value)) return 'N/A';
    const absVal = Math.abs(value);
    if (absVal >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (absVal >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (absVal >= 1e4) return (value / 1e3).toFixed(1) + 'K';
    return value.toString();
}

    /**
     * We initialize scales/axes and append static elements, such as axis titles.
     */
    initVis() {
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .ticks(6)
            .tickSize(-vis.height - 10)
            .tickPadding(10)
            .tickFormat(d3.format("d"));

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(6)
            .tickSize(-vis.width - 10)
            .tickPadding(10)
            .tickFormat(d3.format(".1f"))
            .tickFormat(d => vis.formatNumber(d));


        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        // Append group element that will contain our actual chart 
        // and position it according to the given margin config
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Append empty x-axis group and move it to the bottom of the chart
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        // Append y-axis group
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis(yearIndex) {
        let vis = this;

        // Filter data by year if in comparative mode with year filter
        let workingData = vis.data;
        if (vis.config.isComparative && vis.config.yearFilter) {
            const targetYear = Number(vis.config.yearFilter);
            if (Number.isFinite(targetYear)) {
                workingData = vis.data.filter(d => d[vis.config.yearColumn] === targetYear);
            }
        }

        // Specify accessor functions for the data
        vis.colorValue = d => (d.code || d.Code || d.entity || d.Entity || '').toString().trim();
        
        vis.xValue = d => {
            const xActualRaw = d[vis.config.xActualColumn];
            const xActual = xActualRaw !== null && xActualRaw !== undefined && xActualRaw !== '' ? +xActualRaw : NaN;

            if (isFinite(xActual)) return xActual;

            if (vis.config.xProjectedColumn) {
                const xProjectedRaw = d[vis.config.xProjectedColumn];
                const xProjected = xProjectedRaw !== null && xProjectedRaw !== undefined && xProjectedRaw !== '' ? +xProjectedRaw : NaN;
                if (isFinite(xProjected)) return xProjected;
            }

            return NaN;
        };
        
        vis.yValue = d => {
            const totalRaw = d[vis.config.actualColumn];
            const total = totalRaw !== null && totalRaw !== undefined && totalRaw !== '' ? +totalRaw : NaN;

            if (isFinite(total)) return total;

            const projectedRaw = d[vis.config.projectedColumn];
            const projected = projectedRaw !== null && projectedRaw !== undefined && projectedRaw !== '' ? +projectedRaw : NaN;

            if (isFinite(projected)) return projected;

            return NaN;
        };
        
        // R value accessor for radius scaling
        vis.rValue = d => {
            if (!vis.config.rActualColumn) return 1; // Default if no R column specified
            
            const rActualRaw = d[vis.config.rActualColumn];
            const rActual = rActualRaw !== null && rActualRaw !== undefined && rActualRaw !== '' ? +rActualRaw : NaN;

            if (isFinite(rActual)) return rActual;

            if (vis.config.rProjectedColumn) {
                const rProjectedRaw = d[vis.config.rProjectedColumn];
                const rProjected = rProjectedRaw !== null && rProjectedRaw !== undefined && rProjectedRaw !== '' ? +rProjectedRaw : NaN;
                if (isFinite(rProjected)) return rProjected;
            }

            return NaN;
        };

        // Set the scale input domains (ignore NaN values)
        const xVals = workingData.map(vis.xValue).filter(v => !isNaN(v));
        const yVals = workingData.map(vis.yValue).filter(v => !isNaN(v));
        const rVals = workingData.map(vis.rValue).filter(v => !isNaN(v) && v > 0);

        // Create radius scale for dynamic sizing
        if (rVals.length > 0 && vis.config.isComparative) {
            const rMin = d3.min(rVals);
            const rMax = d3.max(rVals);
            // Use sqrt scale for area-based sizing (more perceptually accurate)
            vis.radiusScale = d3.scaleSqrt()
                .domain([rMin, rMax])
                .range([3, 50]); // Min and max pixel radius
        } else {
            // Fallback to constant radius if not in comparative mode
            vis.radiusScale = () => 4;
        }

        const xMin = d3.min(xVals);
        const xMax = d3.max(xVals);

        // if x values are valid numbers (years), set domain accordingly
        if (isFinite(xMin) && isFinite(xMax)) {
            vis.xScale.domain([xMin, xMax]);

            // Check if x-axis is Year for special formatting
            const isYearAxis = vis.config.xActualColumn === 'Year' || vis.config.xActualColumn === vis.config.yearColumn;
            
            if (isYearAxis) {
                // compute decade-aligned tick values every 10 years
                const startYear = Math.floor(xMin / 10) * 10;
                const endYear = Math.ceil(xMax / 10) * 10;
                const yearTicks = d3.range(startYear, endYear + 1, 10);
                // apply integer formatting and explicit tick values (years only)
                vis.xAxis.tickValues(yearTicks).tickFormat(d3.format("d"));
            } else {
                // For non-year axes, use default ticks with number formatting
                vis.xAxis.tickValues(null).tickFormat(d => vis.formatNumber(d));
            }
        } else {
            vis.xScale.domain(d3.extent(xVals));
        }

        // Set y domain to include negative values
        const yMin = d3.min(yVals);
        const yMax = d3.max(yVals);
        const yRange = yMax - yMin;
        vis.yScale.domain([
            yMin - (yRange > 0 ? yRange * 0.05 : 1),
            yMax + (yRange > 0 ? yRange * 0.05 : 1)
        ]);

        // Calculate the average point (mean of x and y) only if more than 1 data point exists for each year
        vis.avgPointsByYear = d3.groups(workingData, d => d[vis.config.yearColumn])
            .map(([year, group]) => {
                if (group.length > 1) {  // Only calculate average if there are more than 1 data point
                    const avgY = group.reduce((sum, d) => sum + vis.yValue(d), 0) / group.length;
                    return { year: +year, avgY: avgY };
                }
                return null;  // Return null for groups with 1 or fewer points
            })
            .filter(d => d !== null);  // Filter out null values from the array

        // Average point for the whole dataset (not just grouped by year)
        if (xVals.length > 0 && yVals.length > 0) {
            vis.avgPoint = {
                x: d3.mean(xVals),
                y: d3.mean(yVals)
            };
        } else {
            vis.avgPoint = null;
        }

        vis.renderVis(workingData);

        vis.chart.selectAll('.axis-title').remove();  // Remove previous axis titles if they exist
        vis.svg.selectAll('.axis-title').remove();  // Remove previous axis titles if they exist

        // Append x-axis title
        vis.chart.append('text')
            .attr('class', 'axis-title')
            .attr('y', vis.height + 15)
            .attr('x', vis.width + 10)
            .attr('dy', '.71em')
            .style('text-anchor', 'end')
            .text(vis.config.xAxisName);

        // Append y-axis title
        vis.svg.append('text')
            .attr('class', 'axis-title')
            .attr('x', 0)
            .attr('y', 0)
            .attr('dy', '.71em')
            .text(vis.config.yAxisName);
        vis.zoom = d3.zoom()
            .scaleExtent([0.95, 8]) // Min and max zoom
            .translateExtent([
                [0, 0], // Top-left corner (min x, min y)
                [vis.width, vis.height] // Bottom-right corner (max x, max y)
            ])
            .on('zoom', (event) => {
                vis.chart.attr('transform', event.transform);
            });

        // Apply zoom to SVG
        vis.svg.call(vis.zoom);
        
    }


    /**
     * Bind data to visual elements.
     */
    renderVis(workingData) {
        let vis = this;

        // Use passed workingData or fall back to vis.data
        const maxPoints = 1000;
        const dataToRender = workingData || vis.data;
        const scaleFactor = Math.min(1, maxPoints / dataToRender.length);
        // Add circles for data points
        const circles = vis.chart.selectAll('.point')
            .data(dataToRender.filter(d => !isNaN(vis.xValue(d)) && !isNaN(vis.yValue(d))), d => (d.code || d.Code || d.entity || d.Entity || d.trail))
            .join('circle')
            .attr('class', 'point')
            .attr('fill-opacity', 0.5)
            .attr('r', d => {
                const rVal = vis.rValue(d);
                const base = isFinite(rVal) ? vis.radiusScale(rVal) : 4;
                return base * scaleFactor;
            })
            .attr('cy', d => vis.yScale(vis.yValue(d)))
            .attr('cx', d => vis.xScale(vis.xValue(d)))
            .attr('fill', d => {
                const key = vis.colorValue(d);
                return vis.config.colorScale ? vis.config.colorScale(key) : '#999';
            });

        // Add average points for each year
        vis.chart.selectAll('.avg-point')
            .data(vis.avgPointsByYear)
            .join('circle')
            .attr('class', 'avg-point')
            .attr('r', 6)
            .attr('cx', d => vis.xScale(d.year))
            .attr('cy', d => vis.yScale(d.avgY))
            .attr('fill', '#FF6347')  // Use a distinct color for the average points
            .attr('stroke', '#FFD700')
            .attr('stroke-width', 2)
            .attr('opacity', 0.9);

        // Tooltip for average points
        vis.chart.selectAll('.avg-point')
            .on('mouseover', (event, d) => {
                        let avgYDisplay;
        if (!isFinite(d.avgY)) {
            avgYDisplay = 'N/A';
        } else if (Math.abs(d.avgY) >= 1e3) {
            avgYDisplay = vis.formatNumber(d.avgY); // Use K/M/B shorthand
        } else {
            avgYDisplay = d.avgY.toFixed(2);       // Keep small numbers precise
        }
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
                        <div style="font-weight: bold; font-size: 18px;">Average Point</div>
                        <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                            <li>Year: <strong>${d.year}</strong></li>
                            <li>Average X (Year): <strong>${d.year}</strong></li>
                    <li>Average Y (Value): <strong>${avgYDisplay}</strong></li>
                        </ul>
                    `);
            })
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none');
            });

        // Tooltip for regular data points
       // Tooltip for regular data points
circles
    .on('mouseover', (event, d) => {
        const flagUrl = getFlagUrl(d.code || d.Code || d.entity || d.Entity);

        if (vis.config.isComparative) {
            // Multi-variable comparison mode: show X, Y, and R values
            const xValue = vis.xValue(d);
            const yValue = vis.yValue(d);
            
            // Get R value
            const rActualRaw = vis.config.rActualColumn ? d[vis.config.rActualColumn] : null;
            const rActual = rActualRaw !== null && rActualRaw !== undefined && rActualRaw !== '' ? Number(rActualRaw) : null;
            const rProjectedRaw = vis.config.rProjectedColumn ? d[vis.config.rProjectedColumn] : null;
            const rProjected = rProjectedRaw !== null && rProjectedRaw !== undefined && rProjectedRaw !== '' ? Number(rProjectedRaw) : null;
            
            let rValue = null;
            let rIsProjected = false;
            if (isFinite(rActual)) {
                rValue = rActual;
            } else if (isFinite(rProjected)) {
                rValue = rProjected;
                rIsProjected = true;
            }

            // Format values
            const xDisplay = isFinite(xValue) ? (Math.abs(xValue) >= 1e3 ? vis.formatNumber(xValue) : xValue.toFixed(2)) : 'N/A';
            const yDisplay = isFinite(yValue) ? (Math.abs(yValue) >= 1e3 ? vis.formatNumber(yValue) : yValue.toFixed(2)) : 'N/A';
            const rDisplay = rValue !== null && isFinite(rValue) ? (Math.abs(rValue) >= 1e3 ? vis.formatNumber(rValue) : rValue.toFixed(2)) : 'N/A';

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
                        <span style="font-weight: bold; font-size: 18px;">${d.entity || d.Entity || ''}</span>
                        ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
                    </div>
                    <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>${d.year || d.Year || ''}</i></div>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                        <li><strong>${vis.config.xAxisName}:</strong> ${xDisplay}</li>
                        <li><strong>${vis.config.yAxisName}:</strong> ${yDisplay}</li>
                        <li><strong>${vis.config.rAxisName}:</strong> ${rDisplay}${rIsProjected ? ' (Projected)' : ''}</li>
                    </ul>
                `);
        } else {
            // Single variable mode: show original tooltip
            const totalRaw = d[vis.config.actualColumn];
            const total = totalRaw !== null && totalRaw !== undefined && totalRaw !== '' ? Number(totalRaw) : null;
            const projectedRaw = d[vis.config.projectedColumn];
            const projected = projectedRaw !== null && projectedRaw !== undefined && projectedRaw !== '' ? Number(projectedRaw) : null;

            let valueLabel = '';
            let valueNumber = null;
            let isProjected = false;

            if (isFinite(total)) {
                valueLabel = vis.config.actualColumn;
                valueNumber = total;
            } else if (isFinite(projected)) {
                valueLabel = vis.config.projectedColumn;
                valueNumber = projected;
                isProjected = true;
            }

            let valueDisplay;
            if (valueNumber === null || !isFinite(valueNumber)) {
                valueDisplay = 'No data';
            } else if (Math.abs(valueNumber) >= 1e3) {
                valueDisplay = vis.formatNumber(valueNumber);
            } else {
                valueDisplay = valueNumber.toFixed(2);
            }

            const valueLabelHTML = `<strong>${valueDisplay}</strong>${isProjected ? ' (Projected)' : ''}`;

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
                        <span style="font-weight: bold; font-size: 18px;">${d.entity || d.Entity || ''}</span>
                        ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
                    </div>
                    <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>${d.year || d.Year || ''}</i></div>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                        <li>${valueLabel}: ${valueLabelHTML}</li>
                    </ul>
                `);
        }
    })
    .on('mouseleave', () => {
        d3.select('#tooltip').style('display', 'none');
    });


        // Update the axes/gridlines
        vis.xAxisG
            .call(vis.xAxis)
            .call(g => g.select('.domain').remove())
            .call(g => {
                // Dynamically adjust x-axis labels to avoid overlap
                const labels = g.selectAll('.tick text');
                const tickCount = labels.size();
                const spacing = tickCount > 1 ? vis.width / (tickCount - 1) : vis.width;

                labels.style('font-size', '12px').style('fill', '#000');

                if (spacing < 40) {
                    // Rotate labels when narrow
                    labels
                        .attr('transform', 'rotate(-45)')
                        .style('text-anchor', 'end')
                        .attr('dx', '-0.5em')
                        .attr('dy', '0.15em');
                } else {
                    labels
                        .attr('transform', null)
                        .style('text-anchor', 'middle')
                        .attr('dx', null)
                        .attr('dy', null);
                }

                if (spacing < 20) {
                    // If extremely narrow, only show every Nth label
                    const minVisible = 20; // px per label
                    const n = Math.max(1, Math.ceil(minVisible / spacing));
                    labels.each(function(d, i) {
                        d3.select(this).style('display', (i % n === 0) ? null : 'none');
                    });
                } else {
                    labels.style('display', null);
                }
            });

        vis.yAxisG.call(vis.yAxis).call(g => g.select('.domain').remove());
    }

    resize() {
        const parent = document.querySelector(this.config.parentElement);
        this.config.containerWidth = parent.clientWidth;
        this.config.containerHeight = parent.clientHeight;

        this.width = this.config.containerWidth - this.config.margin.left - this.config.margin.right;
        this.height = this.config.containerHeight - this.config.margin.top - this.config.margin.bottom;

        // Resize SVG
        this.svg
            .attr('width', this.config.containerWidth)
            .attr('height', this.config.containerHeight);

        // Update chart group position
        this.chart.attr('transform', `translate(${this.config.margin.left},${this.config.margin.top})`);

        // Update scales
        this.xScale.range([0, this.width]);
        this.yScale.range([this.height, 0]);

        // Update axes positions
        this.xAxisG.attr('transform', `translate(0, ${this.height})`);

        // Adjust tick counts based on width
        const approxTickSpacing = 80; // px between ticks
        const tickCount = Math.max(2, Math.floor(this.width / approxTickSpacing));
        this.xAxis.ticks(tickCount);

        // Optional: update y-axis ticks as well
        const approxYTickSpacing = 50;
        this.yAxis.ticks(Math.max(2, Math.floor(this.height / approxYTickSpacing)));
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
