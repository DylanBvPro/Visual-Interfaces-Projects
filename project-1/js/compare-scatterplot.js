class Comparescatterplot {

    constructor(_config, _actualData, _predictedData) {
        const parent = document.querySelector(_config.parentElement);

        this.config = {
            parentElement: _config.parentElement,
            colorScale: _config.colorScale,
            xAxisName: _config.xAxisName || 'Median Age',  // Update axis title to reflect median age
            projectedXAxisName: _config.projectedXAxisName || 'Median Age',  // Update axis title to reflect median age
            yAxisName: _config.yAxisName || 'Population Growth Rate (%)',
            projectedYAxisName: _config.projectedYAxisName || 'Population Growth Rate (%)',
            groupColumn: _config.groupColumn || 'Entity',   // x-axis categories
            codeColumn: _config.codeColumn || 'Code',       // for flags or IDs
            yearColumn: _config.yearColumn || 'Year',       // year column
            actualColumnAge: _config.actualColumnAge,
            projectedColumnAge: _config.projectedColumnAge,
            actualColumnGrowth: _config.actualColumnGrowth,
            projectedColumnGrowth: _config.projectedColumnGrowth,
            containerWidth: parent ? parent.clientWidth : (_config.containerWidth || 2000),
            containerHeight: parent ? parent.clientHeight : (_config.containerHeight || 300),
            margin: _config.margin || { top: 25, right: 20, bottom: 20, left: 35 },
            tooltipPadding: _config.tooltipPadding || 15
        };
        this.actualData = _actualData || [];
        this.predictedData = _predictedData || [];
        this.data = [...this.actualData, ...this.predictedData]; // combine for median age extraction
        this.years = [];
        this.initVis();
    }

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
            .tickFormat(d3.format(".1f")); // Format median age with 1 decimal place

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(6)
            .tickSize(-vis.width - 10)
            .tickPadding(10)
            .tickFormat(d3.format(".1f"));

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

        // Append both axis titles
        vis.chart.append('text')
            .attr('class', 'axis-title')
            .attr('y', vis.height - 15)
            .attr('x', vis.width + 10)
            .attr('dy', '.71em')
            .style('text-anchor', 'end')
            .text(vis.config.xAxisName); // Use 'Median Age' for x-axis

        vis.svg.append('text')
            .attr('class', 'axis-title')
            .attr('x', 0)
            .attr('y', 0)
            .attr('dy', '.71em')
            .text(vis.config.yAxisName);
    }

updateVis() {
    let vis = this;
    const targetYear = 2021;
    vis.data = [...this.actualData, ...this.predictedData].filter(d => d[vis.config.yearColumn] === targetYear);
    
    // Specify accessor functions for median age dataset
    vis.colorValue = d => (d.code || d.Code || d.entity || d.Entity || '').toString().trim();
    console.log(vis.data);

    vis.xValue = d => {
        const actualAge = +d[vis.config.actualColumnAge];
        const projectedAge = +d[vis.config.projectedColumnAge];
        // Use actualColumnAge if it's valid, otherwise use projectedColumnAge
        return isNaN(actualAge) ? (isNaN(projectedAge) ? NaN : projectedAge) : actualAge;
    };

    vis.yValue = d => {
        const totalRaw = d[vis.config.actualColumnGrowth];
        const total = totalRaw !== null && totalRaw !== undefined && totalRaw !== '' ? +totalRaw : NaN;
        if (isFinite(total)) return total;
        const projectedRaw = d[vis.config.projectedColumnGrowth];
        const projected = projectedRaw !== null && projectedRaw !== undefined && projectedRaw !== '' ? +projectedRaw : NaN;
        if (isFinite(projected)) return projected;
        return NaN;
    };

    // Set the scale input domains (ignore NaN values)
    // Use only points that have both x and y defined so the average is meaningful
    const validData = vis.data.filter(d => !isNaN(vis.xValue(d)) && !isNaN(vis.yValue(d)));
    const xVals = validData.map(vis.xValue);
    const yVals = validData.map(vis.yValue);

    // Compute average point for visible selection
    if (validData.length > 0) {
        vis.avgPoint = {
            x: d3.mean(validData, vis.xValue),
            y: d3.mean(validData, vis.yValue)
        };
    } else {
        vis.avgPoint = null;
    }

    const xMin = 0; // Set the minimum value of x-axis to 0
    const xMax = d3.max(xVals); // Get the maximum value of x-axis
    const xRange = xMax - xMin;

    // Set x scale domain to include 0 and xMax + 5
    if (isFinite(xMax)) {
        vis.xScale.domain([xMin, xMax + 5]); // Set domain from 0 to xMax + 5
        // Adjust tick values (you may want to adjust step size here if needed)
        const medianAgeTicks = d3.range(Math.floor(xMin), Math.ceil(xMax + 5), 5);
        vis.xAxis.tickValues(medianAgeTicks);
    }

    // Set y domain to include negative values and provide padding
    const yMin = d3.min(yVals);
    const yMax = d3.max(yVals);
    const yRange = yMax - yMin;
    vis.yScale.domain([yMin - (yRange > 0 ? yRange * 0.15 : 1), yMax + (yRange > 0 ? yRange * 0.05 : 1)]);

    vis.renderVis();
}


    /**
     * Bind data to visual elements.
     */
renderVis() {
    let vis = this;

    // Add circles for data points
    const circles = vis.chart.selectAll('.point')
        .data(vis.data.filter(d => !isNaN(vis.xValue(d)) && !isNaN(vis.yValue(d))), d => (d.code || d.Code || d.entity || d.Entity || d.trail))
        .join('circle')
        .attr('class', 'point')
        .attr('r', 30)
        .attr('cy', d => vis.yScale(vis.yValue(d)))
        .attr('cx', d => vis.xScale(vis.xValue(d)))
        .attr('fill', d => {
            const key = vis.colorValue(d);
            const color = vis.config.colorScale ? vis.config.colorScale(key) : '#999';
            const rgb = d3.rgb(color);
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`; // 50% opacity
        });

    // Add average point (one per current selection)
    const avgData = vis.avgPoint ? [vis.avgPoint] : [];
    vis.chart.selectAll('.avg-point')
        .data(avgData)
        .join('circle')
        .attr('class', 'avg-point')
        .attr('r', 8)
        .attr('cx', d => vis.xScale(d.x))
        .attr('cy', d => vis.yScale(d.y))
        .attr('fill', '#000')
        .attr('stroke', '#FFD700')
        .attr('stroke-width', 2)
        .attr('opacity', 0.95)
        .on('mouseover', (event, d) => {
            // Tooltip for average point
            const medianAge = d.x ? d.x.toFixed(2) : 'N/A';
            const growthRate = d.y ? d.y.toFixed(2) : 'N/A';

            // Tooltip content for the average point
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
                        <li>Year: <strong>${vis.targetYear}</strong></li> <!-- Display year -->
                        <li>Median Age: <strong>${medianAge}</strong></li>
                        <li>Population Growth Rate: <strong>${growthRate}%</strong></li>
                    </ul>
                `);
        })
        .on('mouseleave', () => {
            d3.select('#tooltip').style('display', 'none');
        });

    // Add label for average point
    vis.chart.selectAll('.avg-label')
        .data(avgData)
        .join('text')
        .attr('class', 'avg-label')
        .attr('x', d => vis.xScale(d.x) + 10)
        .attr('y', d => vis.yScale(d.y) - 10)
        .text('Average')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('fill', '#000');

    // Tooltip event listeners for data points
    circles
        .on('mouseover', (event, d) => {
            const totalRaw = d[vis.config.actualColumnGrowth];
            const total = totalRaw !== null && totalRaw !== undefined && totalRaw !== '' 
                ? Number(totalRaw) 
                : null;

            const projectedRaw = d[vis.config.projectedColumnGrowth];
            const projected = projectedRaw !== null && projectedRaw !== undefined && projectedRaw !== ''
                ? Number(projectedRaw)
                : null;

            const actualAge = +d[vis.config.actualColumnAge];
            const projectedAge = +d[vis.config.projectedColumnAge];
            const medianAge = isNaN(actualAge) ? (isNaN(projectedAge) ? 'N/A' : projectedAge) : actualAge;

            let valueLabel = '';
            let valueNumber = NaN;

            if (isFinite(total)) {
                valueLabel = vis.config.actualColumnGrowth;
                valueNumber = total;
            } else if (isFinite(projected)) {
                valueLabel = vis.config.projectedColumnGrowth;
                valueNumber = projected;
            } else {
                valueLabel = vis.config.actualColumnGrowth;
                valueNumber = 'N/A';
            }

            const flagUrl = getFlagUrl(d.code || d.Code || d.entity || d.Entity);

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
                        <li>${valueLabel}: <strong>${isFinite(valueNumber) ? valueNumber.toFixed(2) : valueNumber}</strong></li>
                        <li>Median Age: <strong>${medianAge !== 'N/A' ? medianAge.toFixed(2) : medianAge}</strong></li>
                    </ul>
                `);
        })
        .on('mouseleave', () => {
            d3.select('#tooltip').style('display', 'none');
        });

    // Update the axes/gridlines
    vis.xAxisG.call(vis.xAxis).call(g => g.select('.domain').remove());
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
    }
}
