console.log("ran main.js");

// Global objects
let data, scatterplot, barchart;
let datafocus, focusContextVis; 
let colorScale = null;
let colorByCode = {};
let geoData;
let choroplethMap;

// Global array for default selected countries (use Codes)
const defaultSelectedCodes = ['USA', 'CHN', 'IND'];
let currentSelectedCodes = [...defaultSelectedCodes];
const dropdown = document.getElementById('variable-dropdown');

const dataOptions = {
    medianAge: {
        actualData: '../data/median-age.csv',  // Your actual data for median age
        entityColumn: 'Entity',
        codeColumn: 'Code',
        yearColumn: 'Year',
        actualColumn: 'Median age, total',
        legendTitle: 'Median Age',
        projectedColumn: 'Median age (Projected)',
    },
    populationGrowth: {
        actualData: '../data/population-growth-rates.csv',  // Your actual data for population growth
        entityColumn: 'Entity',
        codeColumn: 'Code',
        yearColumn: 'Year',
        actualColumn: 'Growth rate, total',
        legendTitle: 'Population Growth Rate (%)',
        projectedColumn: 'Population growth rate (%) (Projected)'
    },
    population: {
        actualData: '../data/population-with-un-projections.csv',  // Your actual data for population growth
        entityColumn: 'Entity',
        codeColumn: 'Code',
        yearColumn: 'Year',
        actualColumn: 'Population, total',
        legendTitle: 'Population',
        projectedColumn: 'Population, medium projection (Projected)'
    },
    lifeExpectancy: {
        actualData: '../data/life-expectancy.csv',  // Your actual data for life expectancy
        entityColumn: 'Entity',
        codeColumn: 'Code',
        yearColumn: 'Year',
        actualColumn: 'Life expectancy',
        legendTitle: 'Life Expectancy',
        projectedColumn: 'N/A'
    },
    // Add more options as needed
};
/**
 * Load data from CSV file asynchronously and render charts
 */

d3.json('../data/worldgeo.json')
  .then(_geoData => {
    geoData = _geoData;

    // Create map once (empty initially)
    choroplethMap = new ChoroplethMap({
      parentElement: '#map'
    }, geoData);
    loadData('medianAge');
  })
  .catch(error => console.error(error));

function loadData(selectedOption) {
    const selectedData = dataOptions[selectedOption];

    // Check if the selected option is valid
    if (!selectedData) {
        console.error(`Invalid data option: ${selectedOption}`);
        return;
    }

    d3.csv(selectedData.actualData).then(_data => {
        data = _data;
if (geoData && choroplethMap) {
    // Build a list of years present in the CSV
    const years = Array.from(new Set(data.map(d => +d[selectedData.yearColumn]).filter(y => !isNaN(y)))).sort((a,b) => a - b);

    // For each GeoJSON feature, attach a map of year -> { actual, projected, entity }
    geoData.features.forEach(feature => {
        feature.properties.data = feature.properties.data || {};
        const rows = data.filter(d => (d.Code || d.code || '') === feature.id);
        rows.forEach(row => {
            const y = +row[selectedData.yearColumn];
            if (isNaN(y)) return;
            const actualRaw = row[selectedData.actualColumn]?.trim();
            const projectedRaw = row[selectedData.projectedColumn]?.trim();
            const actual = actualRaw ? +actualRaw : NaN;
            const projected = projectedRaw ? +projectedRaw : NaN;
            feature.properties.data[y] = {
                actual: Number.isFinite(actual) ? actual : null,
                projected: Number.isFinite(projected) ? projected : null,
                entity: row[selectedData.entityColumn] || row.Entity || feature.properties.name,
                code: row[selectedData.codeColumn] || row.Code || feature.id
            };
        });
    });

    // Configure the choropleth to use the `data` property and legend title
    choroplethMap.config.valueProperty = 'data';
    choroplethMap.config.valueKey = 'actual';
    choroplethMap.config.legendTitle = selectedData.legendTitle || 'Value';

    // Provide years to the map and show the first year
    if (years.length > 0) {
        choroplethMap.setYears(years);
        choroplethMap.updateYear(0);
    } else {
        choroplethMap.updateVis();
    }
}


        // Cast numeric values - be careful with empty strings
        data.forEach(d => {
            const medianTotal = d[selectedData.actualColumn]?.trim();
            const medianProjected = d[selectedData.projectedColumn]?.trim();

            d[selectedData.actualColumn] = medianTotal ? +medianTotal : NaN;
            d[selectedData.projectedColumn] = medianProjected ? +medianProjected : NaN;
            d[selectedData.yearColumn] = +d[selectedData.yearColumn] || +d.Years;
        });

        // Prepare data for scatterplot / focus
        const parseYear = d => {
            const y = (+d[selectedData.yearColumn]) || (+d.year);
            return Number.isFinite(y) ? new Date(y, 0, 1) : null;
        };

        datafocus = data.map(d => ({
            date: parseYear(d),
            close: !isNaN(d[selectedData.actualColumn]) ? d[selectedData.actualColumn] : d[selectedData.projectedColumn],
            Code: d.Code || d.code || '',
            Entity: d.Entity || d.entity || ''
        })).filter(d => d.date instanceof Date && !isNaN(d.date) && !isNaN(d.close));

        // Initialize color scale
        const codes = Array.from(new Set(data.map(d => (d.Code || d.code || '').trim()).filter(Boolean))).sort();
        function generatePalette(n) {
            if (n <= 10 && d3.schemeCategory10) return d3.schemeCategory10.slice(0, n);
            const out = [];
            for (let i = 0; i < n; i++) out.push(d3.interpolateRainbow(i / Math.max(1, n - 1)));
            return out;
        }

const continuous = d3.scaleLinear()
  .domain([0, 0.33, 0.66, 1])
  .range(['#cfe2f2', '#7accc8', '#f2b880', '#0d306b'])
  .interpolate(d3.interpolateHcl);

const palette = codes.map((_, i) => continuous(i / (codes.length - 1)));

const colorScale = d3.scaleOrdinal()
  .domain(codes)
  .range(palette);
  
  colorByCode = Object.fromEntries(codes.map(c => [c, colorScale(c)]));

        // Split data for Barchart: actual vs projected
        const actualData = data.filter(d => !isNaN(d[selectedData.actualColumn]));
        const predictedData = data.filter(d => isNaN(d[selectedData.actualColumn]) && !isNaN(d[selectedData.projectedColumn]));

if (scatterplot) {
    scatterplot.chart.selectAll("*").remove();  
    scatterplot = null; // Nullify the old instance
}

// Initialize scatterplot (recreate it)
scatterplot = new Scatterplot({
    parentElement: '#scatterplot',
    colorScale: colorScale,
    actualColumn: selectedData.actualColumn,
    projectedColumn: selectedData.projectedColumn,
    yearColumn: selectedData.yearColumn,
    codeColumn: selectedData.codeColumn,
    groupColumn: selectedData.entityColumn,
    yAxisName: selectedData.actualColumn
}, actualData, predictedData);
console.log('Created new scatterplot');

scatterplot.updateVis(0); // Re-render the scatterplot

if (barchart) {
    // Clear the content inside the existing SVG but leave the SVG container
    barchart.chart.selectAll("*").remove();  // Remove all child elements inside the chart group (bars, axes, etc.)

    // Optionally, reset some other properties of the chart
    barchart.currentYearIndex = 0; // Reset the year index or other properties if needed
    barchart.animationInterval = null;

    // You can also reapply any necessary settings here if needed (like scale domains or axis configurations)
}

// Initialize barchart (recreate it)
barchart = new Barchart({
    parentElement: '#barchart',
    colorScale: colorScale,
    actualColumn: selectedData.actualColumn,
    projectedColumn: selectedData.projectedColumn,
    yearColumn: selectedData.yearColumn,
    codeColumn: selectedData.codeColumn,
    groupColumn: selectedData.entityColumn,
    yAxisName: selectedData.actualColumn
}, actualData, predictedData);
console.log('Created new barchart');

barchart.updateYear(0); // Re-render the first year of the barchart

// Check if a focus context exists, and if so, remove it
if (focusContextVis) {
    focusContextVis.svg.remove();  // Remove the existing focus context's SVG
    focusContextVis = null;        // Nullify the old instance
}

// Initialize focus context (recreate it)
focusContextVis = new FocusContextVis({
    parentElement: '#chart',
    onBrush: (domain) => {
        scatterplot.datafocus = datafocus.filter(d => d.date >= domain[0] && d.date <= domain[1]);
        scatterplot.updateVis();
    }
}, datafocus);

focusContextVis.updateVis(); // Re-render the focus context visualization

d3.select('#country-filters').selectAll("*").remove();

CountrySelector.init(data, '#country-filters', (selectedCodes) => {
    currentSelectedCodes = selectedCodes;
    filterData(selectedCodes);
}, currentSelectedCodes);

filterData(currentSelectedCodes);

    }).catch(error => console.error(error));
}


/**
 * Filter scatterplot and barchart based on selected countries
 * @param {Array} selectedCodes - Array of country codes
 */
function filterData(selectedCodes) {
    if (!selectedCodes || selectedCodes.length === 0) {
        scatterplot.data = data;
        barchart.data = data;
    } else {
        scatterplot.data = data.filter(d => selectedCodes.includes(d.Code || d.code || ''));
        barchart.data = data.filter(d => selectedCodes.includes(d.Code || d.code || ''));
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

// Initial load for default dropdown value ('medianAge' or any initial selection)
loadData('medianAge'); // Initial data load based on default selection

// Handle dropdown change event
dropdown.addEventListener('change', function (event) {
    const selectedValue = event.target.value;
    console.log(`Selected value from dropdown: ${selectedValue}`); // Log selected value
    loadData(selectedValue); // Load data based on selected dropdown option
});