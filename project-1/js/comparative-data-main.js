console.log("ran comparative-data-main.js");

// Global objects
let data, scatterplot, barchart;
let datafocus, focusContextVis;
let colorByCode = {};
let mergedData = [];

const defaultSelectedCodes = ['USA', 'CHN', 'IND'];
let currentSelectedCodes = [...defaultSelectedCodes];
const currentSettings = {
  rOption: 'Growth Rate',
  xOption: 'year',
  yOption: 'growthRate',
  radius: 4,
  yearFilter: null,
  dataVisualization: 'scatterplot'
};

const dataOption = {
  actualData: '../data/population-growth-rates.csv',
  entityColumn: 'Entity',
  codeColumn: 'Code',
  yearColumn: 'Year',
  actualColumn: 'Growth rate, total',
  projectedColumn: 'Population growth rate (%) (Projected)',
  yAxisName: 'Population Growth Rate (%)'
};

const metricMetadata = {
  population: {
    actualColumn: 'Population, total',
    projectedColumn: 'Population, medium projection (Projected)',
    yAxisName: 'Population'
  },
  growthRate: {
    actualColumn: 'Growth rate, total',
    projectedColumn: 'Population growth rate (%) (Projected)',
    yAxisName: 'Population Growth Rate (%)'
  },
  medianAge: {
    actualColumn: 'Median age, total',
    projectedColumn: 'Median age (Projected)',
    yAxisName: 'Median Age'
  },
  lifeExpectancy: {
    actualColumn: 'Life expectancy',
    projectedColumn: null,
    yAxisName: 'Life Expectancy'
  },
  year: {
    actualColumn: 'Year',
    projectedColumn: null,
    yAxisName: 'Year'
  }
};

function getChartConfig(xMetric, yMetric) {
  const xMeta = metricMetadata[xMetric] || metricMetadata.year;
  const yMeta = metricMetadata[yMetric] || metricMetadata.growthRate;
  
  return {
    entityColumn: 'Entity',
    codeColumn: 'Code', 
    yearColumn: 'Year',
    xActualColumn: xMeta.actualColumn,
    xProjectedColumn: xMeta.projectedColumn,
    xAxisName: xMeta.yAxisName,
    actualColumn: yMeta.actualColumn,
    projectedColumn: yMeta.projectedColumn,
    yAxisName: yMeta.yAxisName
  };
}

function loadData() {
  Promise.all([
    d3.csv('../data/population-growth-rates.csv'),
    d3.csv('../data/population-with-un-projections.csv'),
    d3.csv('../data/median-age.csv'),
    d3.csv('../data/life-expectancy.csv')
  ])
    .then(([growthData, populationData, medianData, lifeExpectancyData]) => {
      const byCodeYear = new Map();

      const upsert = (row) => {
        const code = (row.Code || row.code || '').trim();
        const entity = (row.Entity || row.entity || '').trim();
        const year = +(row.Year || row.Years);
        if (!code || !Number.isFinite(year)) return null;
        const key = `${code}-${year}`;
        if (!byCodeYear.has(key)) {
          byCodeYear.set(key, {
            Code: code,
            Entity: entity,
            Year: year
          });
        }
        return byCodeYear.get(key);
      };

      growthData.forEach(row => {
        const entry = upsert(row);
        if (!entry) return;
        entry['Growth rate, total'] = row['Growth rate, total'];
        entry['Population growth rate (%) (Projected)'] = row['Population growth rate (%) (Projected)'];
      });

      populationData.forEach(row => {
        const entry = upsert(row);
        if (!entry) return;
        entry['Population, total'] = row['Population, total'];
        entry['Population, medium projection (Projected)'] = row['Population, medium projection (Projected)'];
      });

      medianData.forEach(row => {
        const entry = upsert(row);
        if (!entry) return;
        entry['Median age, total'] = row['Median age, total'];
        entry['Median age (Projected)'] = row['Median age (Projected)'];
      });

      lifeExpectancyData.forEach(row => {
        const entry = upsert(row);
        if (!entry) return;
        entry['Life expectancy'] = row['Life expectancy'];
      });

      data = Array.from(byCodeYear.values());
      mergedData = data;

      data.forEach(d => {
        const actualRaw = d[dataOption.actualColumn]?.trim();
        const projectedRaw = d[dataOption.projectedColumn]?.trim();

        d[dataOption.actualColumn] = actualRaw ? +actualRaw : NaN;
        d[dataOption.projectedColumn] = projectedRaw ? +projectedRaw : NaN;
        d[dataOption.yearColumn] = +d[dataOption.yearColumn] || +d.Years;

        d['Population, total'] = d['Population, total']?.toString().trim() ? +d['Population, total'] : NaN;
        d['Population, medium projection (Projected)'] = d['Population, medium projection (Projected)']?.toString().trim() ? +d['Population, medium projection (Projected)'] : NaN;
        d['Median age, total'] = d['Median age, total']?.toString().trim() ? +d['Median age, total'] : NaN;
        d['Median age (Projected)'] = d['Median age (Projected)']?.toString().trim() ? +d['Median age (Projected)'] : NaN;
        d['Life expectancy'] = d['Life expectancy']?.toString().trim() ? +d['Life expectancy'] : NaN;
      });

      datafocus = data.map(d => ({
        date: new Date(d[dataOption.yearColumn], 0, 1),
        close: !isNaN(d[dataOption.actualColumn]) ? d[dataOption.actualColumn] : d[dataOption.projectedColumn],
        Code: d.Code || d.code || '',
        Entity: d.Entity || d.entity || ''
      })).filter(d => d.date instanceof Date && !isNaN(d.date) && !isNaN(d.close));

      const codes = Array.from(new Set(data.map(d => (d.Code || d.code || '').trim()).filter(Boolean))).sort();

      function generatePalette(n) {
        if (n <= 10 && d3.schemeCategory10) return d3.schemeCategory10.slice(0, n);
        const out = [];
        for (let i = 0; i < n; i++) out.push(d3.interpolateRainbow(i / Math.max(1, n - 1)));
        return out;
      }

      const colorScale = d3.scaleOrdinal()
        .domain(codes)
        .range(generatePalette(codes.length));

      colorByCode = Object.fromEntries(codes.map(c => [c, colorScale(c)]));

      d3.select('#country-filters').selectAll('*').remove();

      CountrySelector.init(data, '#country-filters', (selectedCodes) => {
        currentSelectedCodes = selectedCodes;
        filterData(selectedCodes);
      }, currentSelectedCodes);

      rebuildCharts();
    })
    .catch(error => console.error(error));
}

function hasMetricValue(d, metric) {
  if (!metric) return true;

  if (metric === 'year') {
    return Number.isFinite(+d.Year);
  }

  if (metric === 'population') {
    return Number.isFinite(+d['Population, total']) || Number.isFinite(+d['Population, medium projection (Projected)']);
  }

  if (metric === 'growthRate') {
    return Number.isFinite(+d['Growth rate, total']) || Number.isFinite(+d['Population growth rate (%) (Projected)']);
  }

  if (metric === 'medianAge') {
    return Number.isFinite(+d['Median age, total']) || Number.isFinite(+d['Median age (Projected)']);
  }

  if (metric === 'lifeExpectancy') {
    return Number.isFinite(+d['Life expectancy']);
  }

  return true;
}

function metricFromROption(rOption) {
  const map = {
    'Population': 'population',
    'Growth Rate': 'growthRate',
    'Median Age': 'medianAge',
    'Life Expectancy': 'lifeExpectancy'
  };
  return map[rOption] || 'growthRate';
}

function rebuildCharts() {
  if (!mergedData || mergedData.length === 0) return;

  const xMetric = currentSettings.xOption || 'year';
  const yMetric = currentSettings.yOption || 'growthRate';
  const rMetric = metricFromROption(currentSettings.rOption || 'Growth Rate');
  const chartConfig = getChartConfig(xMetric, yMetric);
  const rMeta = metricMetadata[rMetric] || metricMetadata.growthRate;

  const codes = Array.from(new Set(mergedData.map(d => (d.Code || d.code || '').trim()).filter(Boolean))).sort();

  function generatePalette(n) {
    if (n <= 10 && d3.schemeCategory10) return d3.schemeCategory10.slice(0, n);
    const out = [];
    for (let i = 0; i < n; i++) out.push(d3.interpolateRainbow(i / Math.max(1, n - 1)));
    return out;
  }

  const colorScale = d3.scaleOrdinal()
    .domain(codes)
    .range(generatePalette(codes.length));

  let workingData = mergedData;
  
  if (currentSettings.yearFilter && xMetric !== 'year' && yMetric !== 'year') {
    const targetYear = Number(currentSettings.yearFilter);
    if (Number.isFinite(targetYear)) {
      workingData = mergedData.filter(d => d.Year === targetYear);
    }
  }

  const actualData = chartConfig.projectedColumn 
    ? workingData.filter(d => !isNaN(d[chartConfig.actualColumn]))
    : workingData.filter(d => !isNaN(d[chartConfig.actualColumn]));

  const predictedData = chartConfig.projectedColumn
    ? workingData.filter(d => isNaN(d[chartConfig.actualColumn]) && !isNaN(d[chartConfig.projectedColumn]))
    : [];

  if (scatterplot) {
    scatterplot.chart.selectAll('*').remove();
    scatterplot = null;
  }

  scatterplot = new Scatterplot({
    parentElement: '#scatterplot',
    colorScale: colorScale,
    actualColumn: chartConfig.actualColumn,
    projectedColumn: chartConfig.projectedColumn,
    xActualColumn: chartConfig.xActualColumn,
    xProjectedColumn: chartConfig.xProjectedColumn,
    xAxisName: chartConfig.xAxisName,
    yearColumn: chartConfig.yearColumn,
    codeColumn: chartConfig.codeColumn,
    groupColumn: chartConfig.entityColumn,
    yAxisName: chartConfig.yAxisName,
    isComparative: true,
    yearFilter: currentSettings.yearFilter,
    rActualColumn: rMeta.actualColumn,
    rProjectedColumn: rMeta.projectedColumn,
    rAxisName: rMeta.yAxisName,
    dataVisualization: currentSettings.dataVisualization
  }, actualData, predictedData);

  scatterplot.updateVis(0);

  if (barchart) {
    barchart.chart.selectAll('*').remove();
    barchart.currentYearIndex = 0;
    barchart.animationInterval = null;
  }

  barchart = new Barchart({
    parentElement: '#barchart',
    colorScale: colorScale,
    actualColumn: chartConfig.actualColumn,
    projectedColumn: chartConfig.projectedColumn,
    yearColumn: chartConfig.yearColumn,
    codeColumn: chartConfig.codeColumn,
    groupColumn: chartConfig.entityColumn,
    yAxisName: chartConfig.yAxisName
  }, actualData, predictedData);

  barchart.updateYear(0);

  filterData(currentSelectedCodes);
}

function filterData(selectedCodes) {
  if (!scatterplot || !barchart || !Array.isArray(mergedData) || mergedData.length === 0) {
    return;
  }

  const countryFiltered = (!selectedCodes || selectedCodes.length === 0)
    ? [] 
    : mergedData.filter(d => selectedCodes.includes(d.Code || d.code || ''));

  const metricFiltered = countryFiltered.filter(d => {
    const rMetric = metricFromROption(currentSettings.rOption);
    return hasMetricValue(d, currentSettings.xOption)
      && hasMetricValue(d, currentSettings.yOption)
      && hasMetricValue(d, rMetric);
  });

  scatterplot.data = metricFiltered;
  barchart.data = metricFiltered;

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

window.addEventListener('resize', resizeVisualizations);

window.addEventListener('compareSettingsChanged', (event) => {
  const settings = event.detail || {};

  const xChanged = settings.xOption && settings.xOption !== currentSettings.xOption;
  const yChanged = settings.yOption && settings.yOption !== currentSettings.yOption;
  const yearChanged = settings.yearFilter !== undefined && settings.yearFilter !== currentSettings.yearFilter;
  const rChanged = settings.rOption && settings.rOption !== currentSettings.rOption;
  const dataVisualizationChanged = settings.dataVisualization && settings.dataVisualization !== currentSettings.dataVisualization;

  if (settings.rOption) currentSettings.rOption = settings.rOption;
  if (settings.xOption) currentSettings.xOption = settings.xOption;
  if (settings.yOption) currentSettings.yOption = settings.yOption;
  if (settings.yearFilter !== undefined) currentSettings.yearFilter = settings.yearFilter;
  if (settings.dataVisualization) currentSettings.dataVisualization = settings.dataVisualization;

  if (xChanged || yChanged || yearChanged || dataVisualizationChanged) {
    rebuildCharts();
  } else if (rChanged) {
    // Update R config in scatterplot when R option changes
    const rMetric = metricFromROption(currentSettings.rOption);
    const rMeta = metricMetadata[rMetric] || metricMetadata.growthRate;
    if (scatterplot) {
      scatterplot.config.rActualColumn = rMeta.actualColumn;
      scatterplot.config.rProjectedColumn = rMeta.projectedColumn;
      scatterplot.config.rAxisName = rMeta.yAxisName;
    }
    filterData(currentSelectedCodes);
  } else {
    filterData(currentSelectedCodes);
  }
});

window.addEventListener('selectAllCountries', () => {
  // Use CountrySelector's selectAll method to select all countries except World
  if (CountrySelector && CountrySelector.selectAll) {
    CountrySelector.selectAll();
  }
});

window.addEventListener('clearAllCountries', () => {
  // Use CountrySelector's clearAll method to properly clear internal state
  if (CountrySelector && CountrySelector.clearAll) {
    CountrySelector.clearAll();
  }
});


loadData();
