
class Scatterplot {

    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */

    constructor(_config, _data) {
        const parent = document.querySelector(_config.parentElement);

        this.config = {
            parentElement: _config.parentElement,
            colorScale: _config.colorScale,
            containerWidth: parent ? parent.clientWidth : (_config.containerWidth || 2000),
            containerHeight: parent ? parent.clientHeight : (_config.containerHeight || 300),
            margin: _config.margin || { top: 25, right: 20, bottom: 20, left: 35 },
            tooltipPadding: _config.tooltipPadding || 15
        };
        this.data = _data;
        this.initVis();
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
            .tickFormat(d3.format(".1f")); // median age with one decimal

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
            .text('Year');

        vis.svg.append('text')
            .attr('class', 'axis-title')
            .attr('x', 0)
            .attr('y', 0)
            .attr('dy', '.71em')
            .text('Median Age');
    }

    /**
     * Prepare the data and scales before we render it.
     */
    updateVis() {
        let vis = this;

        // Specify accessor functions for median-age dataset
        vis.colorValue = d => (d.code || d.Code || d.entity || d.Entity || '').toString().trim();
        vis.xValue = d => +d.year || +d.Year || NaN;
        vis.yValue = d => {
            const totalRaw = d['Median age, total'];
            const total = totalRaw !== null && totalRaw !== undefined && totalRaw !== '' ? +totalRaw : NaN;

            if (isFinite(total)) return total;

            const projectedRaw = d['Median age (Projected)'];
            const projected = projectedRaw !== null && projectedRaw !== undefined && projectedRaw !== '' ? +projectedRaw : NaN;

            if (isFinite(projected)) return projected;

            return NaN;
        };

        // Set the scale input domains (ignore NaN values)
        const xVals = vis.data.map(vis.xValue).filter(v => !isNaN(v));
        const yVals = vis.data.map(vis.yValue).filter(v => !isNaN(v));

        const xMin = d3.min(xVals);
        const xMax = d3.max(xVals);

        // if x values are valid numbers (years), set domain accordingly
        if (isFinite(xMin) && isFinite(xMax)) {
            vis.xScale.domain([xMin, xMax]);

            // compute decade-aligned tick values every 10 years
            const startYear = Math.floor(xMin / 10) * 10;
            const endYear = Math.ceil(xMax / 10) * 10;
            const yearTicks = d3.range(startYear, endYear + 1, 10);

            // apply integer formatting and explicit tick values (years only)
            vis.xAxis.tickValues(yearTicks).tickFormat(d3.format("d"));
        } else {
            vis.xScale.domain(d3.extent(xVals));
        }

        vis.yScale.domain([0, d3.max(yVals) || 1]);

        vis.renderVis();
    }

    /**
     * Bind data to visual elements.
     */
    renderVis() {
        let vis = this;

        // Add circles
        const circles = vis.chart.selectAll('.point')
            .data(vis.data.filter(d => !isNaN(vis.xValue(d)) && !isNaN(vis.yValue(d))), d => (d.code || d.Code || d.entity || d.Entity || d.trail))
            .join('circle')
            .attr('class', 'point')
            .attr('r', 4)
            .attr('cy', d => vis.yScale(vis.yValue(d)))
            .attr('cx', d => vis.xScale(vis.xValue(d)))
            .attr('fill', d => {
                const key = vis.colorValue(d);
                return vis.config.colorScale ? vis.config.colorScale(key) : '#999';
            });

        // Tooltip event listeners
        circles
            .on('mouseover', (event, d) => {
                // ===== Determine which value to display =====
                const totalRaw = d['Median age, total'];
                const total = totalRaw !== null && totalRaw !== undefined && totalRaw !== '' ? +totalRaw : NaN;

                const projectedRaw = d['Median age (Projected)'];
                const projected = projectedRaw !== null && projectedRaw !== undefined && projectedRaw !== '' ? +projectedRaw : NaN;

                let valueLabel = '';
                let valueNumber = NaN;

                if (isFinite(total)) {
                    valueLabel = 'Median Age';
                    valueNumber = total;
                } else if (isFinite(projected)) {
                    valueLabel = 'Projected Median Age';
                    valueNumber = projected;
                } else {
                    valueLabel = 'Median Age';
                    valueNumber = 'N/A';
                }

                // ===== Get flag URL =====
                const flagUrl = getFlagUrl(d.code || d.Code || d.entity || d.Entity);

                // ===== Tooltip Styling =====
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
        </ul>
      `);
            })
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none');
            });




        // Update the axes/gridlines
        // We use the second .call() to remove the axis and just show gridlines
        vis.xAxisG
            .call(vis.xAxis)
            .call(g => g.select('.domain').remove());

        vis.yAxisG
            .call(vis.yAxis)
            .call(g => g.select('.domain').remove())
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
    const iso2 = getCountryISO2(countryCode);
    return iso2
        ? `https://flagcdn.com/64x48/${iso2.toLowerCase()}.png`
        : '';
}


