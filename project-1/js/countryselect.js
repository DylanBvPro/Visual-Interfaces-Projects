// countryselect.js
// Handles country selection checkboxes with search bar
// Uses 'Entity' for display and 'Code' for tracking

(function() {
  let selectedCountries = new Set(); // Tracks selected country codes
  let allCountries = []; // Array of {Entity, Code}
  let currentOnSelectionChange = null; // Store callback reference
  let currentRenderCheckboxes = null; // Store render function reference

  /**
   * Initialize country selector UI
   * @param {Array} data - CSV data
   * @param {String} containerSelector - CSS selector for container (e.g., '#country-filters')
   * @param {Function} onSelectionChange - Callback when selection changes
   * @param {Array} defaultSelectedCodes - Array of codes selected by default
   */
  function initCountrySelector(data, containerSelector, onSelectionChange, defaultSelectedCodes = []) {
    currentOnSelectionChange = onSelectionChange;
    const container = d3.select(containerSelector);

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
      .style('max-height', '500px')
      .style('overflow-y', 'auto');

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

    // Store render function for external access
    currentRenderCheckboxes = renderCheckboxes;

    // Initial render
    renderCheckboxes();

    // Filter on search
    searchInput.on('input', function(event) {
      const value = this.value;
      renderCheckboxes(value);
    });
  }

  /**
   * Clear all selected countries
   */
  function clearAllSelections() {
    selectedCountries.clear();
    if (currentRenderCheckboxes) {
      currentRenderCheckboxes();
    }
    if (currentOnSelectionChange) {
      currentOnSelectionChange([]);
    }
  }

  /**
   * Select all countries except World
   */
  function selectAllCountries() {
    selectedCountries.clear();
    allCountries.forEach(country => {
      // Exclude "World" or any entity containing "World"
      if (country.Entity.toLowerCase() !== 'world' && !country.Entity.toLowerCase().includes('world')) {
        selectedCountries.add(country.Code);
      }
    });
    if (currentRenderCheckboxes) {
      currentRenderCheckboxes();
    }
    if (currentOnSelectionChange) {
      currentOnSelectionChange(Array.from(selectedCountries));
    }
  }

  // Expose globally
  window.CountrySelector = {
    init: initCountrySelector,
    clearAll: clearAllSelections,
    selectAll: selectAllCountries
  };
})();
