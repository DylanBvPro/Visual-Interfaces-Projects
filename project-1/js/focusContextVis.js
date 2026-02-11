class FocusContextVis {
  /**
   * Class constructor
   * @param {Object} _config - { parentElement: selector, onBrush: callback }
   * @param {Array} _data - Array of data objects with { date, close }
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      width: 800,
      height: 80,
      margin: { top: 10, right: 10, bottom: 20, left: 45 },
      onBrush: _config.onBrush || null
    };

    this.data = _data;
    this.initVis();
  }

  /**
   * Initialize scales, axes, brush, and static elements
   */
  initVis() {
    const vis = this;

    const containerWidth =
      vis.config.width + vis.config.margin.left + vis.config.margin.right;
    const containerHeight =
      vis.config.height + vis.config.margin.top + vis.config.margin.bottom;

    // SVG
    vis.svg = d3.select(vis.config.parentElement)
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    // Context group
    vis.context = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Scales
    vis.xScale = d3.scaleTime().range([0, vis.config.width]);
    vis.yScale = d3.scaleLinear().range([vis.config.height, 0]).nice();

    // Axis
    vis.xAxis = d3.axisBottom(vis.xScale).tickSizeOuter(0);
    vis.xAxisG = vis.context.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${vis.config.height})`);

    // Area path (optional, visual cue of timeline)
    vis.areaPath = vis.context.append('path')
      .attr('class', 'chart-area')
      .attr('pointer-events', 'none');

    // Brush group
    vis.brushG = vis.context.append('g')
      .attr('class', 'brush x-brush');

    // Brush
    vis.brush = d3.brushX()
      .extent([[0, 0], [vis.config.width, vis.config.height]])
      .on('brush end', ({ selection }) => {
        if (vis.config.onBrush) {
          const domain = selection
            ? selection.map(vis.xScale.invert)
            : vis.xScale.domain();
          vis.config.onBrush(domain);
        }
      });

    // Activate brush
    vis.brushG.call(vis.brush);

    // Make sure the brush overlay is interactive
    vis.brushG.selectAll('.overlay')
      .style('pointer-events', 'all')
      .style('cursor', 'crosshair');
  }

  /**
   * Prepare data and scales
   */
  updateVis() {
    const vis = this;

    if (!vis.data || !vis.data.length) {
      console.warn('ContextBrushVis: no data');
      return;
    }

    // Parse dates and numeric values
    const maybeParseDate = d3.timeParse('%Y-%m-%d');
    vis.data.forEach(d => {
      if (typeof d.date === 'string') {
        d.date = maybeParseDate(d.date) || new Date(d.date);
      }
      d.close = +d.close;
    });

    vis.xValue = d => d.date;
    vis.yValue = d => d.close;
    console.log("Open");
    console.log("Close");

    // Area generator (optional)
    vis.area = d3.area()
      .x(d => vis.xScale(vis.xValue(d)))
      .y0(vis.config.height)
      .y1(d => vis.yScale(vis.yValue(d)));

    // Domains
    vis.xScale.domain(d3.extent(vis.data, vis.xValue));
    vis.yScale.domain(d3.extent(vis.data, vis.yValue));

    vis.renderVis();
  }

  /**
   * Render chart
   */
  renderVis() {
    const vis = this;

    // Draw area
    vis.areaPath
      .datum(vis.data)
      .attr('d', vis.area);

    // Draw axis
    vis.xAxisG.call(vis.xAxis);

    // Brush (default full range)
    vis.brushG.call(vis.brush)
      console.log(vis.xScale.range());


    // Make sure brush overlay is interactive
    vis.brushG.selectAll('.overlay')
      .style('pointer-events', 'all')
      .style('cursor', 'crosshair');
  }
}
