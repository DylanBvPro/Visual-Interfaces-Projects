console.log("Hello world");

// Global objects
let data, scatterplot, barchart;
let datafocus, focusContextVis; 
let colorScale = null;
let colorByCode = {};

// Global array for default selected countries (use Codes)
const defaultSelectedCodes = ['USA', 'CHN', 'IND']; // Example, adjust as needed

/**
 * Load data from CSV file asynchronously and render charts
 */
d3.csv('../data/population-growth-rates.csv')
  .then(_data => {
    data = _data;
    
    // Cast numeric values - be careful with empty strings
    data.forEach(d => {
      const growthTotal = d["Growth rate, total"]?.trim();
      const growthProjected = d["Population growth rate (%) (Projected)"]?.trim();
      
      d["Growth rate, total"] = growthTotal ? +growthTotal : NaN;
      d["Population growth rate (%) (Projected)"] = growthProjected ? +growthProjected : NaN;
      d.Year = +d.Year || +d.Years;
    });

    // Prepare data for the Barchart
    const actualData = data.filter(d => !isNaN(d["Growth rate, total"]));
    const predictedData = data.filter(d => isNaN(d["Growth rate, total"]) && !isNaN(d["Population growth rate (%) (Projected)"]));

    // Prepare data for scatterplot/focus
    datafocus = data.map(d => ({
      date: new Date(d.Year, 0, 1),
      close: !isNaN(d["Growth rate, total"]) ? d["Growth rate, total"] : d["Population growth rate (%) (Projected)"],
      Code: d.Code || d.code || '',
      Entity: d.Entity || d.entity || ''
    })).filter(d => d.date instanceof Date && !isNaN(d.date) && !isNaN(d.close));

    console.log('rows loaded:', data.length);
    console.log('actualData length:', actualData.length, actualData.slice(0,5));
    console.log('predictedData length:', predictedData.length, predictedData.slice(0,5));

    // Initialize color scale
    const codes = Array.from(new Set(data.map(d => (d.Code || d.code || '').trim()).filter(Boolean))).sort();

    function generatePalette(n) {
      if (n <= 10 && d3.schemeCategory10) return d3.schemeCategory10.slice(0, n);
      const out = [];
      for (let i = 0; i < n; i++) out.push(d3.interpolateRainbow(i / Math.max(1, n-1)));
      return out;
    }

    colorScale = d3.scaleOrdinal()
      .domain(codes)
      .range(generatePalette(codes.length));

    colorByCode = Object.fromEntries(codes.map(c => [c, colorScale(c)]));

    // Initialize scatterplot
    scatterplot = new Scatterplot({ 
      parentElement: '#scatterplot',
      colorScale: colorScale,
      actualColumn: 'Growth rate, total',
      projectedColumn: 'Population growth rate (%) (Projected)',
      yearColumn: 'Year',
      codeColumn: 'Code',
      groupColumn: 'Entity',
      yAxisName: 'Population Growth Rate (%)'
    }, actualData, predictedData);

    scatterplot.updateVis();

    // Initialize barchart
    barchart = new Barchart({
      parentElement: '#barchart',
      colorScale: colorScale,
      actualColumn: 'Growth rate, total',
      projectedColumn: 'Population growth rate (%) (Projected)',
      yearColumn: 'Year',
      codeColumn: 'Code',
      groupColumn: 'Entity',
      yAxisName: 'Population Growth Rate (%)'
    }, actualData, predictedData);

    // Start with first year
    barchart.updateYear(0);

    // Initialize focus context
    focusContextVis = new FocusContextVis({
      parentElement: '#chart',
      onBrush: (domain) => {
        scatterplot.datafocus = datafocus.filter(d => d.date >= domain[0] && d.date <= domain[1]);
        scatterplot.updateVis();
      }
    }, datafocus);

    focusContextVis.updateVis();

    // Initialize country selector
    CountrySelector.init(data, '#country-filters', (selectedCodes) => {
      filterData(selectedCodes);
      barchart.updateVis(data.filter(d => selectedCodes.includes(d.Code || d.code || '')));
    }, defaultSelectedCodes);

    // Apply default filter
    filterData(defaultSelectedCodes);

  })
  .catch(error => console.error(error));

/**
 * Filter scatterplot and barchart based on selected countries
 * @param {Array} selectedCodes - Array of country codes
 */
function filterData(selectedCodes) {
  if (!selectedCodes || selectedCodes.length === 0) {
    scatterplot.actualData = data.filter(d => !isNaN(d["Growth rate, total"]));
    scatterplot.predictedData = data.filter(d => isNaN(d["Growth rate, total"]) && !isNaN(d["Population growth rate (%) (Projected)"]));
    scatterplot.data = [...scatterplot.actualData, ...scatterplot.predictedData];
    
    barchart.data = data; 
  } else {
    const filtered = data.filter(d => selectedCodes.includes(d.Code || d.code || ''));
    scatterplot.actualData = filtered.filter(d => !isNaN(d["Growth rate, total"]));
    scatterplot.predictedData = filtered.filter(d => isNaN(d["Growth rate, total"]) && !isNaN(d["Population growth rate (%) (Projected)"]));
    scatterplot.data = [...scatterplot.actualData, ...scatterplot.predictedData];
    
    barchart.data = filtered;
  }
  scatterplot.updateVis();
  barchart.updateVis();
}

function resizeVisualizations() {
  if (scatterplot) {
    scatterplot.resize();
    scatterplot.updateVis();
  }
  if (barchart) {
    barchart.resize();
    barchart.updateVis();
  }
}

window.addEventListener('resize', () => {
  resizeVisualizations();
});
