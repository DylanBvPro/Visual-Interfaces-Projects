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
            dataVisualization: _config.dataVisualization || 'scatterplot',
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
        if (absVal >= 2101) return (value / 1e3).toFixed(1) + 'K';
        if (absVal >= 1) return value.toFixed(1);
        if (absVal >= 0.01) return value.toFixed(2);
        return value.toPrecision(2);
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
        const isXYearAxis = vis.config.xActualColumn === 'Year' || vis.config.xActualColumn === vis.config.yearColumn;
        if (vis.config.isComparative && vis.config.yearFilter && !isXYearAxis) {
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
        const rVals = workingData.map(vis.rValue).filter(v => !isNaN(v));

        // Create radius scale for dynamic sizing
        if (rVals.length > 0 && vis.config.isComparative) {
            const rMin = d3.min(rVals);
            const rMax = d3.max(rVals);
            
            // If negative numbers are present, offset to make them positive with additional offset
            let offset = 0;
            if (rMin < 0) {
                const range = rMax - rMin;
                offset = Math.abs(rMin) + range * 0.1; // Offset by abs(min) + 10% of range
            }
            
            // Adjust values for the scale
            const adjustedMin = rMin + offset;
            const adjustedMax = rMax + offset;
            
            // Use sqrt scale for area-based sizing (more perceptually accurate)
            vis.radiusScale = d3.scaleSqrt()
                .domain([adjustedMin, adjustedMax])
                .range([3, 50]); // Min and max pixel radius
            vis.radiusOffset = offset; // Store offset for use in rendering
        } else {
            // Fallback to constant radius if not in comparative mode
            vis.radiusScale = () => 4;
            vis.radiusOffset = 0;
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

        // Route to appropriate visualization based on dataVisualization setting
        switch(vis.config.dataVisualization) {
            case 'heatmap':
                vis.renderHeatmap(workingData);
                break;
            case 'bellcurveScatterplot':
                vis.renderBellcurveScatterplot(workingData);
                break;
            case 'scatterplot':
            default:
                vis.renderScatterplot(workingData);
                break;
        }
    }

    renderScatterplot(workingData) {
        let vis = this;
        
        // Clear other visualization types
        vis.chart.selectAll('.heatmap-cell').remove();
        vis.chart.selectAll('.distribution-curve').remove();
        vis.chart.selectAll('.distribution-area').remove();
        vis.chart.selectAll('.sigma-band').remove();
        vis.chart.selectAll('.sigma-label').remove();
        vis.chart.selectAll('.brush-layer').remove();

        // Use passed workingData or fall back to vis.data
        const maxPoints = 100000;
        const dataToRender = workingData || vis.data;
        const scaleFactor = Math.min(1, maxPoints / dataToRender.length);
        
        // Sort data by R value (largest first, smallest last) for proper layering
        const sortedData = dataToRender
            .filter(d => !isNaN(vis.xValue(d)) && !isNaN(vis.yValue(d)))
            .sort((a, b) => {
                const rValA = vis.rValue(a);
                const rValB = vis.rValue(b);
                const finalA = isFinite(rValA) ? rValA : 0;
                const finalB = isFinite(rValB) ? rValB : 0;
                return finalB - finalA; // Descending order (largest first)
            });
        
        // Add circles for data points
        const circles = vis.chart.selectAll('.point')
            .data(
                sortedData,
                d => (d.code || d.Code || d.entity || d.Entity || d.trail)
            )
            .join('circle')
            .attr('class', 'point')
            .attr('fill-opacity', 0.75)
            .attr('r', d => {
                let rVal = vis.rValue(d);
                if (!isFinite(rVal)) rVal = 4; // fallback for NaN / undefined
                const adjustedVal = rVal + (vis.radiusOffset || 0);
                return vis.radiusScale ? vis.radiusScale(adjustedVal) * scaleFactor : 4 * scaleFactor;
            })
            .attr('cy', d => vis.yScale(vis.yValue(d)))
            .attr('cx', d => vis.xScale(vis.xValue(d)))
            .attr('fill', d => {
                const key = vis.colorValue(d);
                return vis.config.colorScale ? vis.config.colorScale(key) : '#999';
            });

        if (window.enableScatterplotBrush) {
            window.enableScatterplotBrush(vis, circles, {
                getX: d => vis.xScale(vis.xValue(d)),
                getY: d => vis.yScale(vis.yValue(d)),
                keyFn: d => d.code || d.Code
            });
        }

        // Add average points for each year
        vis.chart.selectAll('.avg-point')
            .data(vis.avgPointsByYear)
            .join('circle')
            .attr('class', 'avg-point')
            .attr('r', 6)
            .attr('cx', d => vis.xScale(d.year))
            .attr('cy', d => vis.yScale(d.avgY))
            .attr('fill', '#b4a9a9')  // Use a distinct color for the average points
            .attr('stroke', '#575757')
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
                            <li><strong>${vis.config.xAxisName}:</strong> <strong>${d.year}</strong></li>
                            <li><strong>${vis.config.yAxisName}:</strong> <strong>${avgYDisplay}</strong></li>
                        </ul>
                    `);
            })
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none');
            });

        // Tooltip for regular data points
        // Tooltip for regular data points with keyboard navigation
        let currentNearbyCircles = [];
        let currentSelectedIndex = 0;
        let previouslyHighlightedCircle = null;

        function displayTooltip(event, circlesToShow, selectedIdx = 0) {
            currentNearbyCircles = circlesToShow;
            currentSelectedIndex = selectedIdx;
            
            if (circlesToShow.length === 0) return;

            const circleData = circlesToShow[selectedIdx].data;
            const flagUrl = getFlagUrl(circleData.code || circleData.Code || circleData.entity || circleData.Entity);

            // Highlight the selected circle on the chart
            // Remove highlight from previously selected circle
            if (previouslyHighlightedCircle) {
                previouslyHighlightedCircle
                    .style('stroke', 'none')
                    .style('stroke-width', '0px');
            }

            // Find and highlight the current circle
            const selectedCircle = circles.filter(d => d === circleData);
            if (!selectedCircle.empty()) {
                selectedCircle
                    .style('stroke', '#8c8d97')
                    .style('stroke-width', '5px') 
                    
                previouslyHighlightedCircle = selectedCircle;
            }

            // Show hint if multiple circles nearby
            let hint = '';
            if (circlesToShow.length > 1) {
                hint = `<div style="font-size: 12px; color: #999; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">Use ↑↓ arrows to cycle (${selectedIdx + 1}/${circlesToShow.length})</div>`;
            }

            if (vis.config.isComparative) {
                // Multi-variable comparison mode: show X, Y, and R values
                const xValue = vis.xValue(circleData);
                const yValue = vis.yValue(circleData);

                // Get R value
                const rActualRaw = vis.config.rActualColumn ? circleData[vis.config.rActualColumn] : null;
                const rActual = rActualRaw !== null && rActualRaw !== undefined && rActualRaw !== '' ? Number(rActualRaw) : null;
                const rProjectedRaw = vis.config.rProjectedColumn ? circleData[vis.config.rProjectedColumn] : null;
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
                        <span style="font-weight: bold; font-size: 18px;">${circleData.entity || circleData.Entity || ''}</span>
                        ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
                    </div>
                    <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>${circleData.year || circleData.Year || ''}</i></div>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                        <li><strong>${vis.config.xAxisName}:</strong> ${xDisplay}</li>
                        <li><strong>${vis.config.yAxisName}:</strong> ${yDisplay}</li>
                        <li><strong>${vis.config.rAxisName}:</strong> ${rDisplay}${rIsProjected && !vis.config.rAxisName.includes('Projected') ? ' (Projected)' : ''}</li>
                    </ul>
                    ${hint}
                `);
            } else {
                // Single variable mode
                const totalRaw = circleData[vis.config.actualColumn];
                const total = totalRaw !== null && totalRaw !== undefined && totalRaw !== '' ? Number(totalRaw) : null;
                const projectedRaw = circleData[vis.config.projectedColumn];
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

                const valueLabelHTML = `<strong>${valueDisplay}</strong>${isProjected && !valueLabel.includes('Projected') ? ' (Projected)' : ''}`;

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
                        <span style="font-weight: bold; font-size: 18px;">${circleData.entity || circleData.Entity || ''}</span>
                        ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
                    </div>
                    <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>${circleData.year || circleData.Year || ''}</i></div>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                        <li>${valueLabel}: ${valueLabelHTML}</li>
                    </ul>
                    ${hint}
                `);
            }
        }

        circles
            .on('mouseover', (event, d) => {
                const [mouseX, mouseY] = d3.pointer(event, vis.chart.node());
                const selectionRadius = 50; // Larger radius to find nearby circles
                
                // Find all circles within selection radius
                const dataToRender = workingData || vis.data;
                const nearbyCircles = dataToRender
                    .filter(datum => !isNaN(vis.xValue(datum)) && !isNaN(vis.yValue(datum)))
                    .map(datum => {
                        const cx = vis.xScale(vis.xValue(datum));
                        const cy = vis.yScale(vis.yValue(datum));
                        const distance = Math.sqrt(Math.pow(mouseX - cx, 2) + Math.pow(mouseY - cy, 2));
                        return { data: datum, distance, cx, cy };
                    })
                    .filter(item => item.distance <= selectionRadius)
                    .sort((a, b) => a.distance - b.distance);

                if (nearbyCircles.length === 0) return;

                // Display with keyboard navigation enabled
                displayTooltip(event, nearbyCircles, 0);

                // Add keyboard handler for arrow key navigation
                const keydownHandler = (keyEvent) => {
                    if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
                        keyEvent.preventDefault();
                        
                        // Navigate through nearby circles
                        if (keyEvent.key === 'ArrowUp') {
                            currentSelectedIndex = (currentSelectedIndex - 1 + currentNearbyCircles.length) % currentNearbyCircles.length;
                        } else {
                            currentSelectedIndex = (currentSelectedIndex + 1) % currentNearbyCircles.length;
                        }

                        // Update tooltip
                        displayTooltip(event, currentNearbyCircles, currentSelectedIndex);
                    }
                };

                document.addEventListener('keydown', keydownHandler);

                // Store handler for cleanup on mouseleave
                event.target.__keydownHandler = keydownHandler;
            })
            .on('mouseleave', (event) => {
                d3.select('#tooltip').style('display', 'none');
                
                // Clean up keyboard event listener
                if (event.target.__keydownHandler) {
                    document.removeEventListener('keydown', event.target.__keydownHandler);
                    delete event.target.__keydownHandler;
                }
                
                // Remove highlight from circle
                if (previouslyHighlightedCircle) {
                    previouslyHighlightedCircle
                        .style('stroke', 'none')
                        .style('stroke-width', '0px');
                    previouslyHighlightedCircle = null;
                }
                
                // Reset state
                currentNearbyCircles = [];
                currentSelectedIndex = 0;
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
                    labels.each(function (d, i) {
                        d3.select(this).style('display', (i % n === 0) ? null : 'none');
                    });
                } else {
                    labels.style('display', null);
                }
            });

        vis.yAxisG.call(vis.yAxis).call(g => g.select('.domain').remove());

        // Keep axes and labels above points
        vis.xAxisG.raise();
        vis.yAxisG.raise();
        vis.chart.selectAll('.axis-title').raise();
        vis.svg.selectAll('.axis-title').raise();
    }

    renderHeatmap(workingData) {
        let vis = this;
        
        // Clear previous visualizations
        vis.chart.selectAll('.point').remove();
        vis.chart.selectAll('.avg-point').remove();
        vis.chart.selectAll('.heatmap-cell').remove();
        vis.chart.selectAll('.distribution-curve').remove();
        vis.chart.selectAll('.distribution-area').remove();
        vis.chart.selectAll('.sigma-band').remove();
        vis.chart.selectAll('.sigma-label').remove();
        vis.chart.selectAll('.brush-layer').remove();
        
        const dataToRender = workingData || vis.data;
        const validData = dataToRender.filter(d => !isNaN(vis.xValue(d)) && !isNaN(vis.yValue(d)));
        
        if (validData.length === 0) return;
        
        // Create bins for heatmap
        const xExtent = d3.extent(validData, vis.xValue);
        const yExtent = d3.extent(validData, vis.yValue);
        
        const numBinsX = 20;
        const numBinsY = 20;
        
        const xBinWidth = (xExtent[1] - xExtent[0]) / numBinsX;
        const yBinWidth = (yExtent[1] - yExtent[0]) / numBinsY;
        
        // Count points in each bin
        const heatmapData = [];
        for (let i = 0; i < numBinsX; i++) {
            for (let j = 0; j < numBinsY; j++) {
                const xMin = xExtent[0] + i * xBinWidth;
                const xMax = xMin + xBinWidth;
                const yMin = yExtent[0] + j * yBinWidth;
                const yMax = yMin + yBinWidth;
                
                const count = validData.filter(d => {
                    const x = vis.xValue(d);
                    const y = vis.yValue(d);
                    return x >= xMin && x < xMax && y >= yMin && y < yMax;
                }).length;
                
                if (count > 0) {
                    heatmapData.push({ i, j, count, xMin, yMin, xMax, yMax });
                }
            }
        }
        
        const maxCount = d3.max(heatmapData, d => d.count) || 1;
        const colorScale = d3.scaleSequential(d3.interpolateYlOrRd)
            .domain([0, maxCount]);
        
        const cellWidth = vis.width / numBinsX;
        const cellHeight = vis.height / numBinsY;
        
        vis.chart.selectAll('.heatmap-cell')
            .data(heatmapData)
            .join('rect')
            .attr('class', 'heatmap-cell')
            .attr('x', d => vis.xScale(d.xMin))
            .attr('y', d => vis.yScale(d.yMax))
            .attr('width', cellWidth)
            .attr('height', cellHeight)
            .attr('fill', d => colorScale(d.count))
            .attr('opacity', 0.8)
            .attr('stroke', '#fff')
            .attr('stroke-width', 0.5)
            .on('mouseover', (event, d) => {
                // Highlight cell
                d3.select(event.target)
                    .attr('opacity', 1)
                    .attr('stroke-width', 2)
                    .attr('stroke', '#333');
                
                // Show tooltip
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
                    .style('font-size', '14px')
                    .style('color', '#333')
                    .html(`
                        <div style="font-weight: bold; margin-bottom: 8px;">Bin Data</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li><strong>Count:</strong> ${d.count} ${d.count === 1 ? 'point' : 'points'}</li>
                            <li><strong>${vis.config.xAxisName}:</strong> ${vis.formatNumber(d.xMin)} - ${vis.formatNumber(d.xMax)}</li>
                            <li><strong>${vis.config.yAxisName}:</strong> ${vis.formatNumber(d.yMin)} - ${vis.formatNumber(d.yMax)}</li>
                        </ul>
                    `);
            })
            .on('mouseleave', (event) => {
                // Remove highlight
                d3.select(event.target)
                    .attr('opacity', 0.8)
                    .attr('stroke-width', 0.5)
                    .attr('stroke', '#fff');
                
                // Hide tooltip
                d3.select('#tooltip').style('display', 'none');
            });
        
        // Update the axes
        vis.xAxisG.call(vis.xAxis).call(g => g.select('.domain').remove());
        vis.yAxisG.call(vis.yAxis).call(g => g.select('.domain').remove());

        // Keep axes and labels above cells
        vis.xAxisG.raise();
        vis.yAxisG.raise();
        vis.chart.selectAll('.axis-title').raise();
        vis.svg.selectAll('.axis-title').raise();
    }

    renderBellcurveScatterplot(workingData) {
        let vis = this;
        
        // Clear other visualization types
        vis.chart.selectAll('.heatmap-cell').remove();
        vis.chart.selectAll('.distribution-curve').remove();
        vis.chart.selectAll('.distribution-area').remove();
        vis.chart.selectAll('.sigma-band').remove();
        vis.chart.selectAll('.sigma-label').remove();
        vis.chart.selectAll('.brush-layer').remove();
        
        const dataToRender = workingData || vis.data;
        const validData = dataToRender.filter(d => !isNaN(vis.xValue(d)) && !isNaN(vis.yValue(d)));
        
        if (validData.length === 0) return;
        
        // Get raw values
        const xValues = validData.map(d => vis.xValue(d));
        const yValues = validData.map(d => vis.yValue(d));
        
        // Calculate median (center point) and statistics
        const xMedian = d3.median(xValues);
        const yMedian = d3.median(yValues);
        const xMean = d3.mean(xValues);
        const yMean = d3.mean(yValues);
        const xStdDev = d3.deviation(xValues);
        const yStdDev = d3.deviation(yValues);
        
        // Calculate data extent
        const xExtent = d3.extent(xValues);
        const yExtent = d3.extent(yValues);
        
        // Create transformation: data value -> distance from median (in std devs)
        const xToTScore = (x) => (x - xMedian) / xStdDev;
        const yToTScore = (y) => (y - yMedian) / yStdDev;
        
        // Transform all values to t-scores (standard deviations from median)
        const xTScores = xValues.map(xToTScore);
        const yTScores = yValues.map(yToTScore);
        
        // Get extent in t-score space
        const xTExtent = d3.extent(xTScores);
        const yTExtent = d3.extent(yTScores);
        
        // Make scales symmetric around 0 (median) so median appears in center
        const xMaxAbsT = Math.max(Math.abs(xTExtent[0]), Math.abs(xTExtent[1]));
        const yMaxAbsT = Math.max(Math.abs(yTExtent[0]), Math.abs(yTExtent[1]));
        
        // Error function approximation (for normal CDF calculation)
        function erf(x) {
            // Abramowitz and Stegun approximation
            const sign = x >= 0 ? 1 : -1;
            x = Math.abs(x);
            const a1 = 0.254829592;
            const a2 = -0.284496736;
            const a3 = 1.421413741;
            const a4 = -1.453152027;
            const a5 = 1.061405429;
            const p = 0.3275911;
            const t = 1.0 / (1.0 + p * x);
            const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
            return sign * y;
        }
        
        // Standard normal cumulative distribution function
        function normCDF(z) {
            return 0.5 * (1.0 + erf(z / Math.sqrt(2.0)));
        }
        
        // Map t-score to percentile (0 to 1), then map percentile to visual space
        // This makes confidence bands take up space proportional to their probability
        function tScoreToPercentile(t) {
            return normCDF(t);
        }
        
        // Calculate percentile extents
        const xPercentileExtent = [tScoreToPercentile(-xMaxAbsT), tScoreToPercentile(xMaxAbsT)];
        const yPercentileExtent = [tScoreToPercentile(-yMaxAbsT), tScoreToPercentile(yMaxAbsT)];
        
        // Create scales based on percentiles (probability-weighted space)
        const xPercentileScale = d3.scaleLinear()
            .domain(xPercentileExtent)
            .range([0, vis.width]);
        
        const yPercentileScale = d3.scaleLinear()
            .domain(yPercentileExtent)
            .range([vis.height, 0]);
        
        // Conversion functions: data value -> t-score -> percentile -> pixel
        const xToPixel = (x) => xPercentileScale(tScoreToPercentile(xToTScore(x)));
        const yToPixel = (y) => yPercentileScale(tScoreToPercentile(yToTScore(y)));
        
        // Generate exponential tick marks (denser near center, spread out at extremes)
        function generateExponentialTicks(maxAbsT, median, stdDev, extent) {
            const ticks = [];
            
            // Add median (center)
            ticks.push({ tScore: 0, value: median, label: vis.formatNumber(median) });
            
            // Generate ticks on both sides using exponential spacing
            // Use powers: 0.5, 1, 1.5, 2, 3, 4, etc.
            const steps = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8];
            
            for (let step of steps) {
                if (step > maxAbsT) break;
                
                // Positive side
                const valuePos = median + step * stdDev;
                if (valuePos >= extent[0] && valuePos <= extent[1]) {
                    ticks.push({ tScore: step, value: valuePos, label: vis.formatNumber(valuePos) });
                }
                
                // Negative side
                const valueNeg = median - step * stdDev;
                if (valueNeg >= extent[0] && valueNeg <= extent[1]) {
                    ticks.push({ tScore: -step, value: valueNeg, label: vis.formatNumber(valueNeg) });
                }
            }
            
            return ticks.sort((a, b) => a.tScore - b.tScore);
        }
        
        const xTicks = generateExponentialTicks(xMaxAbsT, xMedian, xStdDev, xExtent);
        const yTicks = generateExponentialTicks(yMaxAbsT, yMedian, yStdDev, yExtent);
        
        // Draw T-score confidence bands (in percentile space for proportional sizing)
        // ±1 std dev (68%), ±2 std dev (95%), ±3 std dev (99.7%)
        const confidenceBands = [
            { t: 3, opacity: 0.08, label: '99.7%' },
            { t: 2, opacity: 0.12, label: '95%' },
            { t: 1, opacity: 0.16, label: '68%' }
        ];
        
        // Draw Y-axis confidence bands (horizontal) - now in percentile space
        confidenceBands.forEach(band => {
            if (band.t <= yMaxAbsT) {
                const topPercentile = tScoreToPercentile(band.t);
                const bottomPercentile = tScoreToPercentile(-band.t);
                
                vis.chart.append('rect')
                    .attr('class', 'sigma-band')
                    .attr('x', 0)
                    .attr('y', yPercentileScale(topPercentile))
                    .attr('width', vis.width)
                    .attr('height', yPercentileScale(bottomPercentile) - yPercentileScale(topPercentile))
                    .attr('fill', '#4a90e2')
                    .attr('opacity', band.opacity)
                    .style('pointer-events', 'none');
            }
        });
        
        // Draw X-axis confidence bands (vertical) - now in percentile space
        confidenceBands.forEach(band => {
            if (band.t <= xMaxAbsT) {
                const leftPercentile = tScoreToPercentile(-band.t);
                const rightPercentile = tScoreToPercentile(band.t);
                
                vis.chart.append('rect')
                    .attr('class', 'sigma-band')
                    .attr('x', xPercentileScale(leftPercentile))
                    .attr('y', 0)
                    .attr('width', xPercentileScale(rightPercentile) - xPercentileScale(leftPercentile))
                    .attr('height', vis.height)
                    .attr('fill', '#e24a4a')
                    .attr('opacity', band.opacity)
                    .style('pointer-events', 'none');
            }
        });
        
        // Draw median lines (at 50th percentile)
        vis.chart.append('line')
            .attr('class', 'sigma-band')
            .attr('x1', 0)
            .attr('x2', vis.width)
            .attr('y1', yPercentileScale(0.5))
            .attr('y2', yPercentileScale(0.5))
            .attr('stroke', '#4a90e2')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.7)
            .style('pointer-events', 'none');
        
        vis.chart.append('line')
            .attr('class', 'sigma-band')
            .attr('x1', xPercentileScale(0.5))
            .attr('x2', xPercentileScale(0.5))
            .attr('y1', 0)
            .attr('y2', vis.height)
            .attr('stroke', '#e24a4a')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.7)
            .style('pointer-events', 'none');
        
        // Add confidence band labels
        const labelBands = [
            { t: 1, label: '68%' },
            { t: 2, label: '95%' },
            { t: 3, label: '99.7%' }
        ];
        
        labelBands.forEach(band => {
            if (band.t <= yMaxAbsT) {
                vis.chart.append('text')
                    .attr('class', 'sigma-label')
                    .attr('x', vis.width - 5)
                    .attr('y', yPercentileScale(tScoreToPercentile(band.t)) - 5)
                    .attr('text-anchor', 'end')
                    .style('font-size', '10px')
                    .style('fill', '#4a90e2')
                    .style('font-weight', 'bold')
                    .style('pointer-events', 'none')
                    .text(`${band.label} (±${band.t}σ)`);
            }
            
            if (band.t <= xMaxAbsT) {
                vis.chart.append('text')
                    .attr('class', 'sigma-label')
                    .attr('x', xPercentileScale(tScoreToPercentile(-band.t)) + 5)
                    .attr('y', 12)
                    .attr('text-anchor', 'start')
                    .style('font-size', '10px')
                    .style('fill', '#e24a4a')
                    .style('font-weight', 'bold')
                    .style('pointer-events', 'none')
                    .text(`${band.label}`);
            }
        });
        
        // Render scatter plot points with transformed positions
        const maxPoints = 100000;
        const scaleFactor = Math.min(1, maxPoints / dataToRender.length);
        
        const sortedData = validData.sort((a, b) => {
            const rValA = vis.rValue(a);
            const rValB = vis.rValue(b);
            const finalA = isFinite(rValA) ? rValA : 0;
            const finalB = isFinite(rValB) ? rValB : 0;
            return finalB - finalA;
        });
        
        const circles = vis.chart.selectAll('.point')
            .data(sortedData, d => (d.code || d.Code || d.entity || d.Entity || d.trail))
            .join('circle')
            .attr('class', 'point')
            .attr('fill-opacity', 0.5)
            .attr('r', d => {
                let rVal = vis.rValue(d);
                if (!isFinite(rVal)) rVal = 4;
                const adjustedVal = rVal + (vis.radiusOffset || 0);
                return vis.radiusScale ? vis.radiusScale(adjustedVal) * scaleFactor : 4 * scaleFactor;
            })
            .attr('cy', d => yToPixel(vis.yValue(d)))
            .attr('cx', d => xToPixel(vis.xValue(d)))
            .attr('fill', d => {
                const key = vis.colorValue(d);
                return vis.config.colorScale ? vis.config.colorScale(key) : '#999';
            });

        if (window.enableScatterplotBrush) {
            window.enableScatterplotBrush(vis, circles, {
                getX: d => xToPixel(vis.xValue(d)),
                getY: d => yToPixel(vis.yValue(d)),
                keyFn: d => d.code || d.Code
            });
        }
        
        // Add tooltips with keyboard navigation
        let currentNearbyCircles = [];
        let currentSelectedIndex = 0;
        let previouslyHighlightedCircle = null;

        function displayTooltip(event, circlesToShow, selectedIdx = 0) {
            currentNearbyCircles = circlesToShow;
            currentSelectedIndex = selectedIdx;
            
            if (circlesToShow.length === 0) return;

            const circleData = circlesToShow[selectedIdx].data;
            const flagUrl = getFlagUrl(circleData.code || circleData.Code || circleData.entity || circleData.Entity);

            // Highlight the selected circle on the chart
            if (previouslyHighlightedCircle) {
                previouslyHighlightedCircle
                    .style('stroke', 'none')
                    .style('stroke-width', '0px');
            }

            const selectedCircle = circles.filter(d => d === circleData);
            if (!selectedCircle.empty()) {
                selectedCircle
                    .style('stroke', '#8c8d97')
                    .style('stroke-width', '5px');
                    
                previouslyHighlightedCircle = selectedCircle;
            }

            // Show hint if multiple circles nearby
            let hint = '';
            if (circlesToShow.length > 1) {
                hint = `<div style="font-size: 12px; color: #999; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">Use ↑↓ arrows to cycle (${selectedIdx + 1}/${circlesToShow.length})</div>`;
            }

            const xValue = vis.xValue(circleData);
            const yValue = vis.yValue(circleData);
            const rValue = vis.rValue(circleData);

            // Format values
            const xDisplay = isFinite(xValue) ? vis.formatNumber(xValue) : 'N/A';
            const yDisplay = isFinite(yValue) ? vis.formatNumber(yValue) : 'N/A';
            const rDisplay = rValue !== null && isFinite(rValue) ? vis.formatNumber(rValue) : 'N/A';

            // Calculate t-scores for display
            const xTScore = xToTScore(xValue);
            const yTScore = yToTScore(yValue);
            const xTDisplay = isFinite(xTScore) ? xTScore.toFixed(2) : 'N/A';
            const yTDisplay = isFinite(yTScore) ? yTScore.toFixed(2) : 'N/A';

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
                        <span style="font-weight: bold; font-size: 18px;">${circleData.entity || circleData.Entity || ''}</span>
                        ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
                    </div>
                    <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>${circleData.year || circleData.Year || ''}</i></div>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
                        <li><strong>${vis.config.xAxisName}:</strong> ${xDisplay} (T: ${xTDisplay}σ)</li>
                        <li><strong>${vis.config.yAxisName}:</strong> ${yDisplay} (T: ${yTDisplay}σ)</li>
                        ${vis.config.rAxisName ? `<li><strong>${vis.config.rAxisName}:</strong> ${rDisplay}</li>` : ''}
                    </ul>
                    ${hint}
                `);
        }

        circles
            .on('mouseover', (event, d) => {
                const [mouseX, mouseY] = d3.pointer(event, vis.chart.node());
                const selectionRadius = 50;
                
                // Find all circles within selection radius
                const nearbyCircles = sortedData
                    .map(datum => {
                        const cx = xToPixel(vis.xValue(datum));
                        const cy = yToPixel(vis.yValue(datum));
                        const distance = Math.sqrt(Math.pow(mouseX - cx, 2) + Math.pow(mouseY - cy, 2));
                        return { data: datum, distance, cx, cy };
                    })
                    .filter(item => item.distance <= selectionRadius)
                    .sort((a, b) => a.distance - b.distance);

                if (nearbyCircles.length === 0) return;

                displayTooltip(event, nearbyCircles, 0);

                // Add keyboard handler for arrow key navigation
                const keydownHandler = (keyEvent) => {
                    if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
                        keyEvent.preventDefault();
                        
                        if (keyEvent.key === 'ArrowUp') {
                            currentSelectedIndex = (currentSelectedIndex - 1 + currentNearbyCircles.length) % currentNearbyCircles.length;
                        } else {
                            currentSelectedIndex = (currentSelectedIndex + 1) % currentNearbyCircles.length;
                        }

                        displayTooltip(event, currentNearbyCircles, currentSelectedIndex);
                    }
                };

                document.addEventListener('keydown', keydownHandler);
                event.target.__keydownHandler = keydownHandler;
            })
            .on('mouseleave', (event) => {
                d3.select('#tooltip').style('display', 'none');
                
                if (event.target.__keydownHandler) {
                    document.removeEventListener('keydown', event.target.__keydownHandler);
                    delete event.target.__keydownHandler;
                }
                
                if (previouslyHighlightedCircle) {
                    previouslyHighlightedCircle
                        .style('stroke', 'none')
                        .style('stroke-width', '0px');
                    previouslyHighlightedCircle = null;
                }
                
                currentNearbyCircles = [];
                currentSelectedIndex = 0;
            });
        
        // Update the axes with custom tick values (showing original data values)
        // Map ticks to percentiles and create a lookup
        const percentileKey = (value) => value.toFixed(6);
        const xTickPercentiles = xTicks.map(t => ({
            percentile: tScoreToPercentile(t.tScore),
            label: t.label
        }));
        
        const yTickPercentiles = yTicks.map(t => ({
            percentile: tScoreToPercentile(t.tScore),
            label: t.label
        }));
        
        const xTickLookup = new Map(
            xTickPercentiles.map(t => [percentileKey(t.percentile), t.label])
        );
        const yTickLookup = new Map(
            yTickPercentiles.map(t => [percentileKey(t.percentile), t.label])
        );
        
        const xAxis = d3.axisBottom(xPercentileScale)
            .tickValues(xTickPercentiles.map(t => t.percentile))
            .tickFormat((percentile) => {
                return xTickLookup.get(percentileKey(percentile)) || '';
            });
        
        const yAxis = d3.axisLeft(yPercentileScale)
            .tickValues(yTickPercentiles.map(t => t.percentile))
            .tickFormat((percentile) => {
                return yTickLookup.get(percentileKey(percentile)) || '';
            });
        
        vis.xAxisG
            .call(xAxis)
            .call(g => g.select('.domain').remove())
            .call(g => {
                g.selectAll('.tick text')
                    .style('font-size', '11px')
                    .style('fill', '#000');
                
                // Highlight median tick
                g.selectAll('.tick')
                    .filter((d) => Math.abs(d - 0.5) < 0.01)
                    .select('text')
                    .style('font-weight', 'bold')
                    .style('fill', '#e24a4a');
            });
        
        vis.yAxisG
            .call(yAxis)
            .call(g => g.select('.domain').remove())
            .call(g => {
                g.selectAll('.tick text')
                    .style('font-size', '11px')
                    .style('fill', '#000');
                
                // Highlight median tick
                g.selectAll('.tick')
                    .filter((d) => Math.abs(d - 0.5) < 0.01)
                    .select('text')
                    .style('font-weight', 'bold')
                    .style('fill', '#4a90e2');
            });
        
        // Add crosshair marker at median intersection
        const medianX = xPercentileScale(0.5);
        const medianY = yPercentileScale(0.5);
        
        vis.chart.append('circle')
            .attr('class', 'sigma-band')
            .attr('cx', medianX)
            .attr('cy', medianY)
            .attr('r', 5)
            .attr('fill', 'none')
            .attr('stroke', '#666')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7)
            .style('pointer-events', 'none');
        
        vis.chart.append('circle')
            .attr('class', 'sigma-band')
            .attr('cx', medianX)
            .attr('cy', medianY)
            .attr('r', 2)
            .attr('fill', '#666')
            .attr('opacity', 0.7)
            .style('pointer-events', 'none');
        
        // Add info label
        vis.chart.append('text')
            .attr('class', 'sigma-label')
            .attr('x', 5)
            .attr('y', vis.height - 5)
            .attr('text-anchor', 'start')
            .style('font-size', '10px')
            .style('fill', '#666')
            .text(`Median: X=${xMedian.toFixed(1)}, Y=${yMedian.toFixed(1)} | n=${validData.length}`);

        // Keep axes and labels above points
        vis.xAxisG.raise();
        vis.yAxisG.raise();
        vis.chart.selectAll('.axis-title').raise();
        vis.svg.selectAll('.axis-title').raise();
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
