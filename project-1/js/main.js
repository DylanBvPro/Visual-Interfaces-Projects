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
d3.csv('data/median-age.csv')
  .then(_data => {
    data = _data;

    data.forEach(d => {
      d["Growth rate, total"] = +d["Growth rate, total"];
      d.Years = +d.Years;
    });

    const parseYear = d => {
      const y = (+d.Year) || (+d.year);
      return Number.isFinite(y) ? new Date(y, 0, 1) : null;
    };

    datafocus = data.map(d => ({
      date: parseYear(d),
      close: +d['Median age, total'] || +d['Median'] || +d['Median age (Projected)'] || NaN,
      Code: d.Code || d.code || '',
      Entity: d.Entity || d.entity || ''
    })).filter(d => d.date instanceof Date && !isNaN(d.date) && !isNaN(d.close));

    console.log('rows loaded:', data.length);
    console.log('datafocus length:', datafocus.length, datafocus.slice(0,5));

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
      colorScale: colorScale
    }, data);

    scatterplot.updateVis();

    // Initialize barchart
    barchart = new Barchart({
      parentElement: '#barchart',
      colorScale: colorScale
    }, data);

    barchart.updateVis();

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
    filterData(defaultSelectedCodes);

  })
  .catch(error => console.error(error));


/**
 * Filter scatterplot based on selected countries
 * @param {Array} selectedCodes - Array of country codes
 */
function filterData(selectedCodes) {
  if (!selectedCodes || selectedCodes.length === 0) {
    scatterplot.data = data; // show all
    barchart.data = data; // show all
  } else {
    scatterplot.data = data.filter(d => selectedCodes.includes(d.Code || d.code || ''));
    barchart.data = data.filter(d => selectedCodes.includes(d.Code || d.code || ''));
  }
  scatterplot.updateVis();
  barchart.updateVis();
}


