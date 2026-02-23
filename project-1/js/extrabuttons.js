// countryselect.js
// Handles country selection checkboxes with search bar
// Uses 'Entity' for display and 'Code' for tracking

(function() {
  let selectedCountries = new Set(); // Tracks selected country codes
  let allCountries = []; // Array of {Entity, Code}
  let allData = []; // Array to store all data, assuming 'Year' and 'Country' info exists
  
  /**
   * Initialize country selector UI
   * @param {Array} data - CSV data
   * @param {String} containerSelector - CSS selector for container (e.g., '#country-filters')
   * @param {Function} onSelectionChange - Callback when selection changes
   * @param {Array} defaultSelectedCodes - Array of codes selected by default
   */
  function initCountrySelector(data, containerSelector, onSelectionChange, defaultSelectedCodes = []) {
    const container = d3.select(containerSelector);

    // Save data for computing averages later
    allData = data;

    // Extract unique countries with Entity and Code
    const countryMap = {};
    data.forEach(d => {
      const code = (d.Code || d.code || '').trim();
      const entity = (d.Entity || d.entity || '').trim();
      if (code && entity && !countryMap[code]) {
        countryMap[code] = entity;
      }
    });

    allCountries = Object.entries(countryMap)
      .map(([code, entity]) => ({ Code: code, Entity: entity }))
      .sort((a,b) => a.Entity.localeCompare(b.Entity));

    // Track default selections
    selectedCountries = new Set(defaultSelectedCodes.filter(c => countryMap[c]));

    // Create search input
    const searchInput = container.append('input')
      .attr('type', 'text')
      .attr('placeholder', 'Search countries...')
      .style('margin', '5px 0')
      .style('padding', '5px')
      .style('width', '200px');

    // Container for checkboxes
    const listContainer = container.append('div')
      .attr('class', 'checkbox-list')
      .style('max-height', '200px')
      .style('overflow-y', 'auto');

    // Average Box container
    const avgBoxContainer = container.append('div')
      .attr('class', 'average-box')
      .style('margin-top', '20px')
      .style('padding', '10px')
      .style('background-color', '#f4f4f4')
      .style('border-radius', '5px')
      .style('border', '1px solid #ccc')
      .style('display', 'none') // Initially hidden
      .html('<strong>Average per Year:</strong>');

    // Create buttons for calculating averages
    const buttonContainer = container.append('div')
      .style('margin-top', '20px');

    buttonContainer.append('button')
      .attr('id', 'totalAverageBtn')
      .text('Total Average')
      .on('click', function() {
        const totalAvg = calculateTotalAverage(allData);
        alert(`Total Average: ${totalAvg.toFixed(2)}`);
      });

    buttonContainer.append('button')
      .attr('id', 'enabledAverageBtn')
      .text('Average of Enabled')
      .on('click', function() {
        const enabledAvg = calculateAverageOfEnabled(allData, Array.from(selectedCountries));
        alert(`Average of Enabled: ${enabledAvg.toFixed(2)}`);
      });

    function updateAverageBox() {
      if (selectedCountries.size > 0) {
        // Calculate the average for each year across selected countries
        const selectedData = allData.filter(d => selectedCountries.has(d.Code));
        const yearData = d3.nest()
          .key(d => d.Year)
          .rollup(leaves => {
            const sum = d3.sum(leaves, d => +d.Value); // Assuming 'Value' is the data we want to average
            const count = leaves.length;
            return sum / count; // Calculate the average
          })
          .entries(selectedData);

        // Render the averages in the box
        avgBoxContainer.style('display', 'block');
        avgBoxContainer.selectAll('p').remove(); // Clear previous results

        yearData.forEach(d => {
          avgBoxContainer.append('p')
            .text(`Year: ${d.key}, Average: ${d.value.toFixed(2)}`);
        });
      } else {
        avgBoxContainer.style('display', 'none');
      }
    }

    function renderCheckboxes(filterText = '') {
      const filtered = allCountries.filter(c => 
        c.Entity.toLowerCase().includes(filterText.toLowerCase())
      );

      // Bind data with key = Code
      const items = listContainer.selectAll('.country-checkbox-label')
        .data(filtered, d => d.Code);

      // EXIT
      items.exit().remove();

      // ENTER
      const itemsEnter = items.enter()
        .append('label')
        .attr('class', 'country-checkbox-label')
        .style('display', 'block')
        .style('margin-right', '10px');

      itemsEnter.append('input')
        .attr('type', 'checkbox')
        .attr('class', 'country-checkbox')
        .attr('value', d => d.Code)
        .property('checked', d => selectedCountries.has(d.Code))
        .on('change', function(event, d) {
          if (this.checked) selectedCountries.add(d.Code);
          else selectedCountries.delete(d.Code);
          onSelectionChange(Array.from(selectedCountries));
          updateAverageBox(); // Update average box when selection changes
        });

      itemsEnter.append('span')
        .text(d => ' ' + d.Entity);

      // MERGE ENTER + UPDATE
      const itemsMerge = itemsEnter.merge(items);

      itemsMerge.select('input')
        .property('checked', d => selectedCountries.has(d.Code));

      itemsMerge.select('span')
        .text(d => ' ' + d.Entity);
    }

    // Initial render
    renderCheckboxes();

    // Filter on search
    searchInput.on('input', function(event) {
      const value = this.value;
      renderCheckboxes(value);
    });
  }

  // Function to calculate total average (across all countries and years)
  function calculateTotalAverage(data) {
    const sum = d3.sum(data, d => +d.Value); // Assuming 'Value' is the field we want to average
    const count = data.length;
    return sum / count;
  }

  // Function to calculate average of enabled countries
  function calculateAverageOfEnabled(data, selectedCodes) {
    const selectedData = data.filter(d => selectedCodes.includes(d.Code));
    const sum = d3.sum(selectedData, d => +d.Value); // Assuming 'Value' is the field we want to average
    const count = selectedData.length;
    return sum / count;
  }

  // Expose globally
  window.CountrySelector = {
    init: initCountrySelector
  };
})();
