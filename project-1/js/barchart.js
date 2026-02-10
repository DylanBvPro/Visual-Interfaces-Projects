class Barchart {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      colorScale: _config.colorScale,
      containerWidth: _config.containerWidth || 500,
      containerHeight: _config.containerHeight || 300,
      margin: _config.margin || {top: 25, right: 20, bottom: 20, left: 35},
      tooltipPadding: _config.tooltipPadding || 15
    };
    this.data = _data;
    this.displayData = _data;
    this.years = [];
    this.currentYearIndex = 0;
    this.isPlaying = false;
    this.animationInterval = null;
    this.initVis();
  }
  
  /**
   * Initialize scales/axes and append static elements
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

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
        .tickPadding(10);

    // Define size of SVG drawing area
    vis.svg = d3.select(vis.config.parentElement)
        .attr('width', vis.config.containerWidth)
        .attr('height', vis.config.containerHeight);

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
        .attr('x', vis.width / 2)
        .attr('y', vis.height + vis.config.margin.bottom - 4)
        .style('text-anchor', 'middle')
        .text('Country');

    vis.chart.append('text')
        .attr('class', 'axis-title')
        .attr('transform', `rotate(-90)`)
        .attr('x', -vis.height / 2)
        .attr('y', -vis.config.margin.left + 12)
        .style('text-anchor', 'middle')
        .text('Mean Median Age');

    // Create year selector controls
    vis.initYearControls();
  }

  /**
   * Initialize year selector controls (play/pause, slider, year display)
   */
initYearControls() {
  let vis = this;
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
  playBtn.id = 'play-btn';
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

  // Set initial year
  vis.updateYear(0);
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
    if (document.getElementById('year-slider')) {
      document.getElementById('year-slider').value = index;
    }
    vis.updateVis(null, year);
  }

  /**
   * Toggle play/pause animation
   */
  togglePlay() {
    let vis = this;
    vis.isPlaying = !vis.isPlaying;
    const playBtn = document.getElementById('play-btn');
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

    vis.colorValue = d => (d.code || d.Code || d.entity || d.Entity || '').toString().trim();
    vis.yValue = d => +d.median || +d['Median age, total'] || NaN;
    vis.yearValue = d => +d.year || +d.Year || NaN;

    let dataForYear = vis.displayData;
    if (year !== null) {
      dataForYear = vis.displayData.filter(d => vis.yearValue(d) === year);
    }

    // Aggregate by entity/code for the selected year
    const grouped = Array.from(
      d3.rollup(
        dataForYear,
        v => d3.mean(v, d => vis.yValue(d)),
        d => vis.colorValue(d)
      ),
      ([key, value]) => ({ key, value })
    ).filter(d => isFinite(d.value))
    .sort((a, b) => b.value - a.value);

    vis.xScale.domain(grouped.map(d => d.key));
    vis.yScale.domain([0, d3.max(grouped, d => d.value) || 1]);

    // Update title with current year
    vis.currentYear = year;
    vis.renderVis(grouped);
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
        .attr('class', 'bar')
        .attr('x', d => vis.xScale(d.key))
        .attr('width', d => vis.xScale.bandwidth())
        .attr('y', d => vis.yScale(d.value))
        .attr('height', d => vis.height - vis.yScale(d.value))
        .attr('fill', d => vis.config.colorScale ? vis.config.colorScale(d.key) : '#999');

    // Tooltip event listeners
    bars
        .on('mouseover', (event,d) => {
          d3.select('#tooltip')
            .style('display', 'block')
            .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')   
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
            .html(`
              <div class="tooltip-title">${d.key}</div>
              <ul>
                <li>Mean Median Age: ${d.value.toFixed(2)}</li>
                <li>Year: ${d.Year}</li>
              </ul>
            `);
        })
        .on('mouseleave', () => {
          d3.select('#tooltip').style('display', 'none');
        });
    
    // Update the axes
    vis.xAxisG
        .call(vis.xAxis)
        .call(g => g.select('.domain').remove());

    vis.yAxisG
        .call(vis.yAxis)
        .call(g => g.select('.domain').remove());
  }
}
