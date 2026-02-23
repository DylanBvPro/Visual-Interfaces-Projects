console.log("Hello world");

// Global objects
let data, scatterplot, barchart;
let datafocus, focusContextVis; 
let colorScale = null;
let colorByCode = {};

window.addEventListener('compareSettingsChanged', (event) => {
  if (!scatterplot || typeof scatterplot.applySettings !== 'function') return;
  scatterplot.applySettings(event.detail || {});
});

// Global array for default selected countries (use Codes)
const defaultSelectedCodes = ['USA', 'CHN', 'IND']; // Example, adjust as needed

/**
 * Load both data from CSV files asynchronously and render charts
 */
Promise.all([
  d3.csv('../data/median-age.csv'),
  d3.csv('../data/population-growth-rates.csv')
])
.then(([medianAgeData, populationGrowthData]) => {
  //console.log('Median Age Data loaded:', medianAgeData.length);
  //console.log('Population Growth Data loaded:', populationGrowthData);
    // Merge the data by matching on both `Code` and `Year` (or a similar unique key)
    data = mergeData(medianAgeData, populationGrowthData);  // Ensure merge is by both 'Code' and 'Year'
    // Cast numeric values carefully for both median age and population growth
    data.forEach(d => {
        // For Median Age data
        const medianAgeTotal = d["Median age, total"]?.trim();
        const medianAgeProjected = d["Median age (Projected)"]?.trim();
        
        // For Population Growth data
        const growthTotal = d["Growth rate, total"]?.trim();
        const growthProjected = d["Population growth rate (%) (Projected)"]?.trim();

        //console.log('Before update:', growthTotal, growthProjected); // Debugging line

        // Ensure median age is kept separate
        d["Median age, total"] = medianAgeTotal ? +medianAgeTotal : NaN;
        d["Median age (Projected)"] = medianAgeProjected ? +medianAgeProjected : NaN;

        // Handle growth rate separately for actual and projected values
        if (growthTotal && growthProjected) {
            // If both are available, use the actual growth for the actual column, projected growth for the projected column
            d["Growth rate, total"] = +growthTotal;
            d["Population growth rate (%) (Projected)"] = +growthProjected;
        } else if (growthTotal) {
            // If only actual growth is available, use it
            d["Growth rate, total"] = +growthTotal;
            d["Population growth rate (%) (Projected)"] = NaN; // Set projected as NaN if not available
        } else if (growthProjected) {
            // If only projected growth is available, use it
            d["Growth rate, total"] = NaN; // Set actual growth as NaN
            d["Population growth rate (%) (Projected)"] = +growthProjected;
        } else {
            // If both are missing, set both to NaN
            d["Growth rate, total"] = NaN;
            d["Population growth rate (%) (Projected)"] = NaN;
        }

        // Ensure Year is handled correctly as numeric
        d.Year = +d.Year || +d.Years;

        // Log the updated data for checking
        //console.log("Data d:", d);
    });

    // Prepare data for the Barchart
    const actualData = data.filter(d => !isNaN(d["Growth rate, total"]));
    const predictedData = data.filter(d => isNaN(d["Growth rate, total"]) && !isNaN(d["Population growth rate (%) (Projected)"]));

    // Prepare data for scatterplot/focus
    datafocus = data.map(d => ({
      date: new Date(d.Year, 0, 1),
      close: !isNaN(d["Median age, total"]) ? d["Median age, total"] : d["Median age (Projected)"],
      Code: d.Code || d.code || '',
      Entity: d.Entity || d.entity || ''
    })).filter(d => d.date instanceof Date && !isNaN(d.date) && !isNaN(d.close));

    console.log('rows loaded:', data.length);
    console.log('actualData length:', actualData.length, actualData.slice(0, 5));
    console.log('predictedData length:', predictedData.length, predictedData.slice(0, 5));

    // Initialize color scale
    const codes = Array.from(new Set(data.map(d => (d.Code || d.code || '').trim()).filter(Boolean))).sort();

    function generatePalette(n) {
      if (n <= 10 && d3.schemeCategory10) return d3.schemeCategory10.slice(0, n);
      const out = [];
      for (let i = 0; i < n; i++) out.push(d3.interpolateRainbow(i / Math.max(1, n - 1)));
      return out;
    }

    colorScale = d3.scaleOrdinal()
      .domain(codes)
      .range(generatePalette(codes.length));

    colorByCode = Object.fromEntries(codes.map(c => [c, colorScale(c)]));
    
    // Initialize scatterplot
    scatterplot = new Comparescatterplot({ 
      parentElement: '#scatterplot',
      colorScale: colorScale,
      yearColumn: 'Year',
      codeColumn: 'Code',
      groupColumn: 'Entity',
      yAxisName: 'Population Growth Rate (%)',
      actualColumnAge: 'Median age, total',
      projectedColumnAge: 'Median age (Projected)',
      actualColumnGrowth: 'Growth rate, total',
      projectedColumnGrowth: 'Population growth rate (%) (Projected)'
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
 * Merge data from both CSV files by matching on the 'Code' field.
 * Assumes that the 'Code' field exists in both datasets.
 * @param {Array} medianAgeData - Data from median-age.csv
 * @param {Array} populationGrowthData - Data from populationgrowthrates.csv
 * @returns {Array} - Merged data array
 */
function mergeData(medianAgeData, populationGrowthData) {
  // Create a map of population growth data indexed by both 'Code' and 'Year'
  const populationGrowthMap = populationGrowthData.reduce((map, d) => {
    const key = `${d.Code || d.code}-${d.Year}`; // Unique key for both Code and Year
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(d); // Store multiple entries for the same country-year combination
    return map;
  }, {});

  // Merge population growth data into the median age data based on both 'Code' and 'Year'
  return medianAgeData.map(d => {
    const code = d.Code || d.code;
    const year = d.Year || d.Years;
    const key = `${code}-${year}`; // Create the key for the current entry

    const populationDataList = populationGrowthMap[key]; // Find matching population data for that country-year combination
    
    if (populationDataList) {
      // If multiple entries exist for the same country-year, combine them
      return populationDataList.map(populationData => ({
        ...d,
        "Population growth rate (%) (Projected)": populationData["Population growth rate (%) (Projected)"],
        "Growth rate, total": populationData["Growth rate, total"]
      }));
    }
    
    return d; // Return original row if no matching population growth data is found
  }).flat(); // Flatten the array to return a single array of merged data
}


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
  
  // Ensure to update visualizations with new filtered data
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
