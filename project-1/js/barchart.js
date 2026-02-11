class Barchart {
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
        margin: _config.margin || { top: 25, right: 20, bottom: 20, left: 35 },
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
        .tickPadding(10);

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
    vis.resize();
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
    vis.yAxis = d3.axisLeft(vis.yScale).ticks(6).tickSize(-vis.width - 10).tickPadding(10);

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

  // Use the provided data, or default to the full dataset
  vis.displayData = filteredData || vis.data;
  if (!vis.displayData || !Array.isArray(vis.displayData)) return;

  // Accessors
  vis.colorValue = d => (d.code || d.Code || d.entity || d.Entity || '').toString().trim();
  vis.yValue = d => +d.median || +d['Median age, total'] || NaN;
  vis.yearValue = d => +d.year || +d.Year || NaN;

  // Ensure years array is populated
  if (!vis.years || vis.years.length === 0) {
    vis.years = vis.getYears();
  }

  // If no year is provided, fallback to currentYear or first year in the dataset
  if (year == null || !isFinite(year) || !vis.years.includes(year)) {
    year = vis.currentYear || (vis.years.length > 0 ? vis.years[0] : null); 
  }

  // Guard against invalid year
  if (!isFinite(year)) {
    console.warn('Barchart.updateVis: No valid year available');
    return;
  }

  // Filter data for the selected year
  let dataForYear = vis.displayData.filter(d => vis.yearValue(d) === year);
  
  // Guard against no data for this year
  if (dataForYear.length === 0) {
    console.warn(`Barchart.updateVis: No data found for year ${year}`);
    return;
  }

  // Aggregate by entity/code
  const grouped = Array.from(
    d3.rollup(
      dataForYear,
      v => d3.mean(v, d => vis.yValue(d)),
      d => vis.colorValue(d)
    ),
    ([key, value]) => ({ key, value, year }) // attach the actual year here
  )
  .filter(d => isFinite(d.value))
  .sort((a, b) => b.value - a.value);

  // Update scales
  vis.xScale.domain(grouped.map(d => d.key));
  vis.yScale.domain([0, d3.max(grouped, d => d.value) || 1]);

  // Update current year and render
  vis.currentYear = year;
  vis.renderVis(grouped);

  // If hovering, update tooltip immediately
  if (vis.hoveredBar) {
    const d = d3.select(vis.hoveredBar).datum();
    d3.select('#tooltip')
      .html(`
        <div class="tooltip-title">${d.key}</div>
        <ul>
          <li>Median Age: ${d.value.toFixed(2)}</li>
          <li>Year: ${d.year}</li>
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
        .attr('y', d => vis.yScale(d.value))
        .attr('height', d => vis.height - vis.yScale(d.value))
        .attr('fill', d => vis.config.colorScale ? vis.config.colorScale(d.key) : '#999');

    // Tooltip event listeners
    bars
        .on('mouseover', (event,d) => {
            vis.hoveredBar = event.currentTarget;
            const medianAge = isFinite(d.value) ? d.value.toFixed(2) : 'N/A';
            const yearText = isFinite(d.year) ? d.year : 'Unknown';
          d3.select('#tooltip')
            .style('display', 'block')
            .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')   
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
            .html(`
              <div class="tooltip-title">${d.key}</div>
              <ul>
                <li>Median Age: ${medianAge}</li>
                <li>Year: ${yearText}</li>
              </ul>
            `);
        })
        .on('mouseleave', () => {
        vis.hoveredBar = null;
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
