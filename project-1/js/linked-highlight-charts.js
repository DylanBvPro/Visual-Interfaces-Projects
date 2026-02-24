(function () {
  function toNumber(value) {
    if (value === null || value === undefined) return NaN;
    const str = String(value).trim();
    if (!str) return NaN;
    const num = +str;
    return Number.isFinite(num) ? num : NaN;
  }

  function formatShort(value) {
    if (!Number.isFinite(value)) return 'N/A';
    const absVal = Math.abs(value);
    if (absVal >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (absVal >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (absVal >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    if (absVal >= 1) return value.toFixed(2);
    return value.toPrecision(2);
  }

  function buildColorScale(codes) {
    const unique = Array.from(new Set(codes.filter(Boolean))).sort();
    const ramp = d3.scaleLinear()
      .domain([0, 0.33, 0.66, 1])
      .range(['#cfe2f2', '#7accc8', '#f2b880', '#0d306b'])
      .interpolate(d3.interpolateHcl);

    const palette = unique.map((_, i) => {
      const t = unique.length > 1 ? i / (unique.length - 1) : 0;
      return ramp(t);
    });

    return d3.scaleOrdinal().domain(unique).range(palette);
  }

  function normalizeRows(rows, config) {
    const out = [];
    rows.forEach((row) => {
      const code = (row[config.codeColumn] || row.Code || row.code || '').trim();
      const entity = (row[config.entityColumn] || row.Entity || row.entity || '').trim();
      const year = toNumber(row[config.yearColumn] ?? row.Year ?? row.year ?? row.Years);
      const actual = toNumber(row[config.actualColumn]);
      const projected = toNumber(row[config.projectedColumn]);
      const value = Number.isFinite(actual) ? actual : projected;

      if (!code || !entity || !Number.isFinite(year) || !Number.isFinite(value)) return;

      out.push({
        code,
        entity,
        year,
        value,
        actual,
        projected
      });
    });
    return out;
  }

  function indexByYear(rows) {
    const map = new Map();
    rows.forEach((row) => {
      if (!map.has(row.year)) map.set(row.year, []);
      map.get(row.year).push(row);
    });
    map.forEach((arr) => {
      arr.sort((a, b) => b.value - a.value);
    });
    return map;
  }

  function ensureTooltip() {
    let tooltip = d3.select('#linked-chart-tooltip');
    if (!tooltip.empty()) return tooltip;

    tooltip = d3.select('body')
      .append('div')
      .attr('id', 'linked-chart-tooltip')
      .style('position', 'absolute')
      .style('display', 'none')
      .style('pointer-events', 'auto')
      .style('background-color', 'rgba(255,255,255,0.95)')
      .style('border', '1px solid #ccc')
      .style('border-radius', '8px')
      .style('padding', '10px 15px')
      .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
      .style('font-family', 'Arial, sans-serif')
      .style('font-size', '16px')
      .style('color', '#333')
      .style('max-width', '500px')
      .style('z-index', '10000');

    return tooltip;
  }

  function getFlagUrlSafe(countryCode) {
    if (!countryCode) return '';
    if (typeof getCountryISO2 !== 'function') return '';
    const iso2 = getCountryISO2(countryCode);
    return iso2 ? `https://flagcdn.com/64x48/${iso2.toLowerCase()}.png` : '';
  }

  function toggleCountrySelection(state, countryCode) {
    const code = (countryCode || '').trim();
    if (!code) return;

    const nextSelected = new Set(state.selectedCodes);
    if (nextSelected.has(code)) {
      nextSelected.delete(code);
    } else {
      nextSelected.add(code);
    }

    const shouldSelect = nextSelected.has(code);
    const container = document.querySelector(state.config.countryFilterSelector);
    const checkbox = container
      ? container.querySelector(`input.country-checkbox[value="${code}"]`)
      : null;

    if (checkbox) {
      checkbox.checked = shouldSelect;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    state.selectedCodes = nextSelected;
    render(state);
  }

  function createState(config, rows) {
    const yearIndex = indexByYear(rows);
    const years = Array.from(yearIndex.keys()).sort((a, b) => a - b);
    const codes = rows.map((d) => d.code);

    return {
      config,
      rows,
      yearIndex,
      years,
      yearPos: 0,
      selectedCodes: new Set(config.defaultSelectedCodes || []),
      colorScale: buildColorScale(codes),
      geoData: null,
      choroplethMap: null
    };
  }

  function nearestYearIndex(years, targetYear) {
    if (!years.length) return 0;
    let bestIdx = 0;
    let bestDiff = Math.abs(years[0] - targetYear);

    for (let i = 1; i < years.length; i += 1) {
      const diff = Math.abs(years[i] - targetYear);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    return bestIdx;
  }

  function drawScatterplot(state) {
    const cfg = state.config;
    const year = state.years[state.yearPos];
    const yearRows = state.yearIndex.get(year) || [];

    const svg = d3.select(cfg.scatterplotSelector);
    const width = Math.max(300, svg.node().clientWidth || cfg.scatterWidth || 900);
    const height = cfg.scatterHeight || 420;
    svg.attr('width', width).attr('height', height);

    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const plot = svg.selectAll('g.linked-scatter-root')
      .data([null])
      .join('g')
      .attr('class', 'linked-scatter-root')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const ranked = yearRows.map((d, i) => ({ ...d, rank: i + 1 }));

    const x = d3.scaleLinear()
      .domain([1, Math.max(1, ranked.length)])
      .range([0, innerW]);

    const yExtent = d3.extent(ranked, (d) => d.value);
    const minY = Number.isFinite(yExtent[0]) ? yExtent[0] : 0;
    const maxY = Number.isFinite(yExtent[1]) ? yExtent[1] : 1;
    const pad = maxY - minY > 0 ? (maxY - minY) * 0.08 : 1;

    const y = d3.scaleLinear()
      .domain([minY - pad, maxY + pad])
      .nice()
      .range([innerH, 0]);

    let activeX = x.copy();
    let activeY = y.copy();

    plot.selectAll('g.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')))
      .call((g) => g.select('.domain').remove());

    plot.selectAll('g.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).ticks(7).tickFormat((d) => formatShort(d)))
      .call((g) => g.select('.domain').remove());

    plot.selectAll('text.x-label')
      .data([null])
      .join('text')
      .attr('class', 'x-label')
      .attr('x', innerW)
      .attr('y', innerH + 34)
      .attr('text-anchor', 'end')
      .text('Country rank (by value)');

    plot.selectAll('text.y-label')
      .data([null])
      .join('text')
      .attr('class', 'y-label')
      .attr('x', 0)
      .attr('y', -6)
      .text(cfg.actualColumn);

    const tooltip = ensureTooltip();

    const showCountryTooltip = (event, d) => {
      const flagUrl = getFlagUrlSafe(d.code);
      tooltip
        .style('display', 'block')
        .style('left', `${event.pageX + 12}px`)
        .style('top', `${event.pageY + 12}px`)
        .html(`
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-weight: bold; font-size: 18px;">${d.entity}</span>
            ${flagUrl ? `<img src="${flagUrl}" style="width:48px; height:32px; border-radius: 3px;">` : ''}
          </div>
          <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>Year: ${d.year}</i></div>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
            <li>Value: <strong>${formatShort(d.value)}</strong></li>
            <li>Rank: <strong>${d.rank}</strong></li>
          </ul>
        `);
    };

    const circles = plot.selectAll('circle.country-point')
      .data(ranked, (d) => d.code)
      .join('circle')
      .attr('class', 'country-point')
      .attr('cx', (d) => x(d.rank))
      .attr('cy', (d) => y(d.value))
      .attr('r', (d) => state.selectedCodes.has(d.code) ? 4.5 : 3)
      .attr('fill', (d) => state.selectedCodes.has(d.code) ? state.colorScale(d.code) : '#bfbfbf')
      .attr('opacity', (d) => state.selectedCodes.has(d.code) ? 0.95 : 0.30)
      .attr('stroke', (d) => state.selectedCodes.has(d.code) ? '#222' : 'none')
      .attr('stroke-width', (d) => state.selectedCodes.has(d.code) ? 0.8 : 0)
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        showCountryTooltip(event, d);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        toggleCountrySelection(state, d.code);
      })
      .on('mouseleave', () => {
        tooltip.style('display', 'none');
      });

    const updateScatterGeometry = () => {
      plot.select('g.x-axis')
        .call(d3.axisBottom(activeX).ticks(8).tickFormat(d3.format('d')))
        .call((g) => g.select('.domain').remove());

      plot.select('g.y-axis')
        .call(d3.axisLeft(activeY).ticks(7).tickFormat((d) => formatShort(d)))
        .call((g) => g.select('.domain').remove());

      circles
        .attr('cx', (d) => activeX(d.rank))
        .attr('cy', (d) => activeY(d.value));
    };

    const brush = d3.brush()
      .extent([[0, 0], [innerW, innerH]])
      .on('end', (event) => {
        if (!event.selection) {
          const source = event.sourceEvent;
          const isClickLike = source && (source.type === 'click' || source.type === 'mouseup');
          if (isClickLike) {
            const [mx, my] = d3.pointer(source, plot.node());
            let closest = null;
            let minDistance = Infinity;

            ranked.forEach((d) => {
              const dx = activeX(d.rank) - mx;
              const dy = activeY(d.value) - my;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDistance) {
                minDistance = dist;
                closest = d;
              }
            });

            if (closest && minDistance <= 14) {
              toggleCountrySelection(state, closest.code);
            }
          }
          return;
        }

        const [[x0, y0], [x1, y1]] = event.selection;
        const brushedCodes = ranked
          .filter((d) => {
            const cx = activeX(d.rank);
            const cy = activeY(d.value);
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
          })
          .map((d) => d.code)
          .filter(Boolean);

        if (brushedCodes.length > 0) {
          if (window.CountrySelector && typeof window.CountrySelector.setSelected === 'function') {
            window.CountrySelector.setSelected(brushedCodes, true);
          } else {
            state.selectedCodes = new Set(brushedCodes);
            render(state);
          }
        }

        plot.select('.linked-brush-layer').call(brush.move, null);
      });

    plot.selectAll('.linked-brush-layer').remove();
    const brushLayer = plot.append('g')
      .attr('class', 'linked-brush-layer')
      .call(brush);

    // Add a background rect for plot area hover detection (doesn't block brush)
    plot.selectAll('.linked-tooltip-background').remove();
    plot.insert('rect', ':first-child')
      .attr('class', 'linked-tooltip-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'none')
      .attr('pointer-events', 'none')
      .on('mouseleave', () => {
        tooltip.style('display', 'none');
      });

    // Monitor the entire plot area for hover, but don't block interactions
    plot.on('mousemove.tooltip', function(event) {
      // Only show tooltip if not actively brushing
      if (event.sourceEvent && event.sourceEvent.buttons !== 0) {
        tooltip.style('display', 'none');
        return;
      }

      const [mx, my] = d3.pointer(event, this);
      let closest = null;
      let minDistance = Infinity;

      ranked.forEach((d) => {
        const dx = activeX(d.rank) - mx;
        const dy = activeY(d.value) - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDistance) {
          minDistance = dist;
          closest = d;
        }
      });

      if (closest && minDistance <= 14) {
        showCountryTooltip(event, closest);
      } else {
        tooltip.style('display', 'none');
      }
    }).on('mouseleave.tooltip', () => {
      tooltip.style('display', 'none');
    });

    // Create zoom handler with stopImmediatePropagation to avoid blocking brush
    const scatterZoom = d3.zoom()
      .filter((event) => {
        // Only zoom on wheel, allow brush/other handlers on other events
        if (event.type !== 'wheel') return false;
        return true;
      })
      .scaleExtent([1, 12])
      .translateExtent([[0, 0], [innerW, innerH]])
      .extent([[0, 0], [innerW, innerH]])
      .on('zoom', (event) => {
        activeX = event.transform.rescaleX(x);
        activeY = event.transform.rescaleY(y);
        updateScatterGeometry();
      });

    // Register zoom on the SVG but ensure brush layer stays interactive
    svg.on('.linked-scatter-zoom', null);
    svg.call(scatterZoom);
    
    // Bring brush layer to front so it receives events before zoom handler
    plot.select('.linked-brush-layer').raise();
  }

  function drawBarchart(state) {
    const cfg = state.config;
    const year = state.years[state.yearPos];
    const yearRows = state.yearIndex.get(year) || [];

    const svg = d3.select(cfg.barchartSelector);
    const width = Math.max(300, svg.node().clientWidth || cfg.barWidth || 900);
    const height = cfg.barHeight || 430;
    svg.attr('width', width).attr('height', height);

    const margin = { top: 20, right: 20, bottom: 70, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const plot = svg.selectAll('g.linked-bar-root')
      .data([null])
      .join('g')
      .attr('class', 'linked-bar-root')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const binCount = 8;
    const minVal = d3.min(yearRows, (d) => d.value);
    const maxVal = d3.max(yearRows, (d) => d.value);
    const minValue = Number.isFinite(minVal) ? minVal : 0;
    const maxValue = Number.isFinite(maxVal) ? maxVal : 1;
    const valueRange = maxValue - minValue;
    const binSize = valueRange > 0 ? valueRange / binCount : 1;

    const bins = Array.from({ length: binCount }, (_, idx) => {
      const x0 = minValue + idx * binSize;
      const x1 = idx === binCount - 1 ? maxValue : (minValue + (idx + 1) * binSize);
      return {
        idx,
        x0,
        x1,
        allCount: 0,
        selectedCount: 0,
        selectedCountries: [],
        allActualCount: 0,
        allProjectedCount: 0,
        selectedActualCount: 0,
        selectedProjectedCount: 0
      };
    });

    yearRows.forEach((d) => {
      const binIndex = valueRange > 0
        ? Math.min(binCount - 1, Math.floor((d.value - minValue) / binSize))
        : 0;
      const bin = bins[binIndex];
      const usesActual = Number.isFinite(d.actual);
      bin.allCount += 1;
      if (usesActual) {
        bin.allActualCount += 1;
      } else {
        bin.allProjectedCount += 1;
      }
      if (state.selectedCodes.has(d.code)) {
        bin.selectedCount += 1;
        bin.selectedCountries.push(d.entity);
        if (usesActual) {
          bin.selectedActualCount += 1;
        } else {
          bin.selectedProjectedCount += 1;
        }
      }
    });

    const x = d3.scaleBand()
      .domain(bins.map((d) => String(d.idx)))
      .range([0, innerW])
      .padding(0.2);

    const maxCount = d3.max(bins, (d) => d.allCount) || 1;

    const y = d3.scaleLinear()
      .domain([0, maxCount])
      .nice()
      .range([innerH, 0]);

    plot.selectAll('g.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((d) => {
        const bin = bins[+d];
        if (!bin) return '';
        return `${formatShort(bin.x0)}–${formatShort(bin.x1)}`;
      }))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('text').attr('transform', 'rotate(-18)').style('text-anchor', 'end'));

    plot.selectAll('g.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format('d')))
      .call((g) => g.select('.domain').remove());

    plot.selectAll('line.zero-line')
      .data([null])
      .join('line')
      .attr('class', 'zero-line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(0))
      .attr('y2', y(0))
      .attr('stroke', '#999')
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0.6);

    plot.selectAll('text.y-label')
      .data([null])
      .join('text')
      .attr('class', 'y-label')
      .attr('x', 0)
      .attr('y', -6)
      .text('Countries in value range');

    plot.selectAll('text.x-label')
      .data([null])
      .join('text')
      .attr('class', 'x-label')
      .attr('x', innerW)
      .attr('y', innerH + 56)
      .attr('text-anchor', 'end')
      .text(`${cfg.actualColumn} (range)`);

    const tooltip = ensureTooltip();

    const showBinTooltip = (event, d) => {
      // Clear any existing auto-scroll intervals
      const existingScrollContainer = tooltip.node()?.querySelector('.country-list-container');
      if (existingScrollContainer?._autoScrollInterval) {
        clearInterval(existingScrollContainer._autoScrollInterval);
      }
      
      // Create styled badges for selected countries with flags
      const selectedList = d.selectedCountries.length > 0
        ? d.selectedCountries.map(country => {
            // Try to get the country code for this entity name
            const countryRow = yearRows.find(r => r.entity === country);
            const code = countryRow ? countryRow.code : '';
            const flagUrl = getFlagUrlSafe(code);
            const colorHue = (country.charCodeAt(0) + country.length) % 360;
            
            return `
              <div style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                margin: 3px;
                background: linear-gradient(135deg, hsl(${colorHue}, 65%, 92%), hsl(${colorHue}, 55%, 85%));
                border: 1px solid hsl(${colorHue}, 45%, 75%);
                border-radius: 16px;
                font-size: 12px;
                font-weight: 500;
                color: #333;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              ">
                ${flagUrl ? `<img src="${flagUrl}" style="width: 20px; height: 15px; border-radius: 2px; object-fit: cover;">` : '🌍'}
                <span>${country}</span>
              </div>`;
          }).join('')
        : '<div style="text-align: center; padding: 8px; color: #999; font-style: italic;">No countries selected in this bin</div>';
      
      // Calculate tooltip position to keep it in viewport
      const tooltipWidth = 500;
      let left = event.pageX + 12;
      let top = event.pageY + 12;
      
      // Adjust horizontal position if tooltip would go off right edge
      if (left + tooltipWidth > window.pageXOffset + window.innerWidth) {
        left = event.pageX - tooltipWidth - 12;
      }
      
      tooltip
        .style('display', 'block')
        .style('left', `${left}px`)
        .style('top', `${top}px`)
        .html(`
          <style>
            @keyframes autoScroll {
              0% { scroll-behavior: smooth; }
              100% { scroll-behavior: smooth; }
            }
            .country-list-container {
              animation: autoScroll 1s linear infinite;
            }
          </style>
          <div style="font-weight: bold; font-size: 18px; margin-bottom: 8px;">${cfg.actualColumn} ${d.idx + 1}/8</div>
          <div style="font-size: 14px; color: #555; margin-bottom: 6px;"><i>Year: ${year}</i></div>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
            <li>Range: <strong>${formatShort(d.x0)} to ${formatShort(d.x1)}</strong></li>
            <li>All Countries: <strong>${d.allCount}</strong></li>
            <li>All Type: <strong>Actual ${d.allActualCount}, Projected ${d.allProjectedCount}</strong></li>
            <li>Selected Countries: <strong>${d.selectedCount}</strong></li>
            <li>Selected Type: <strong>Actual ${d.selectedActualCount}, Projected ${d.selectedProjectedCount}</strong></li>
          </ul>
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #ddd;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; color: #0d306b;">
              Selected in this Bin ${d.selectedCountries.length > 0 ? `(${d.selectedCountries.length})` : ''}
            </div>
            <div class="country-list-container" style="
              display: flex;
              flex-wrap: wrap;
              gap: 2px;
              padding: 4px;
              background: #f8f9fa;
              border-radius: 8px;
              cursor: default;
              max-height: 300px;
              overflow-y: auto;
              scroll-behavior: smooth;
            ">
              ${selectedList}
            </div>
          </div>
        `);
      
      // Start auto-scroll animation
      const scrollContainer = tooltip.node().querySelector('.country-list-container');
      if (scrollContainer && d.selectedCountries.length > 8) {
        let scrollPos = 0;
        const scrollSpeed = 0.8;
        let isPaused = false;
        
        const autoScrollInterval = setInterval(() => {
          if (tooltip.style('display') === 'none') {
            clearInterval(autoScrollInterval);
            return;
          }
          
          if (isPaused) return;
          
          const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
          
          scrollPos += scrollSpeed;
          scrollContainer.scrollTop = scrollPos;
          
          if (scrollPos >= maxScroll) {
            // Reached the bottom, pause
            isPaused = true;
            setTimeout(() => {
              // Reset everything back to top
              scrollPos = 0;
              scrollContainer.scrollTop = 0;
              isPaused = false;
            }, 1000); // 1 second rest at bottom
          }
        }, 20);
        
        // Store interval reference to clear it later
        scrollContainer._autoScrollInterval = autoScrollInterval;
      }
    };

    plot.selectAll('rect.bin-all')
      .data(bins, (d) => d.idx)
      .join('rect')
      .attr('class', 'bin-all')
      .attr('x', (d) => x(String(d.idx)))
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.allCount))
      .attr('height', (d) => Math.max(1, innerH - y(d.allCount)))
      .attr('fill', '#d3d3d3')
      .attr('opacity', 0.65)
      .attr('stroke', '#9b9b9b')
      .attr('stroke-width', 0.7);

    plot.selectAll('rect.bin-selected')
      .data(bins, (d) => d.idx)
      .join('rect')
      .attr('class', 'bin-selected')
      .attr('x', (d) => x(String(d.idx)))
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.selectedCount))
      .attr('height', (d) => Math.max(0, innerH - y(d.selectedCount)))
      .attr('fill', '#0d306b')
      .attr('opacity', (d) => d.selectedCount > 0 ? 0.88 : 0.2)
      .attr('stroke', (d) => d.selectedCount > 0 ? '#081d40' : 'none')
      .attr('stroke-width', (d) => d.selectedCount > 0 ? 1.2 : 0);

    plot.selectAll('rect.bin-hover-layer').remove();
    
    let hideTooltipTimeout = null;
    
    const scheduleHideTooltip = () => {
      if (hideTooltipTimeout) clearTimeout(hideTooltipTimeout);
      hideTooltipTimeout = setTimeout(() => {
        // Clear any auto-scroll intervals
        const scrollContainer = tooltip.node()?.querySelector('.country-list-container');
        if (scrollContainer?._autoScrollInterval) {
          clearInterval(scrollContainer._autoScrollInterval);
        }
        tooltip.style('display', 'none');
      }, 300);
    };
    
    const cancelHideTooltip = () => {
      if (hideTooltipTimeout) {
        clearTimeout(hideTooltipTimeout);
        hideTooltipTimeout = null;
      }
    };
    
    // Add event handlers to tooltip to keep it visible when hovering
    tooltip
      .on('mouseenter', cancelHideTooltip)
      .on('mouseleave', () => {
        // Clear any auto-scroll intervals
        const scrollContainer = tooltip.node()?.querySelector('.country-list-container');
        if (scrollContainer?._autoScrollInterval) {
          clearInterval(scrollContainer._autoScrollInterval);
        }
        tooltip.style('display', 'none');
      });
    
    plot.append('rect')
      .attr('class', 'bin-hover-layer')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('mousemove', (event) => {
        cancelHideTooltip();
        const [mx] = d3.pointer(event, plot.node());
        const step = innerW / binCount;
        const idx = Math.max(0, Math.min(binCount - 1, Math.floor(mx / Math.max(step, 1e-6))));
        const bin = bins[idx];
        if (bin) showBinTooltip(event, bin);
      })
      .on('mouseleave', scheduleHideTooltip);
  }

  function drawChoroplethMap(state) {
    if (!state.geoData) {
      console.warn('Map skipped: no geoData');
      return;
    }

    // Check if ChoroplethMap is available (try different references)
    const MapClass = window.ChoroplethMap || (typeof ChoroplethMap !== 'undefined' ? ChoroplethMap : null);
    if (!MapClass) {
      console.warn('Map skipped: ChoroplethMap class not available. Globals available:', Object.keys(window).filter(k => k.includes('Map') || k.includes('Choropleth')));
      return;
    }

    const cfg = state.config;
    const mapSelector = cfg.choroplethSelector;

    const resolveFeatureCode = (feature) => {
      const raw = feature?.id
        || feature?.properties?.ISO_A3
        || feature?.properties?.iso_a3
        || feature?.properties?.ISO3
        || feature?.properties?.iso3
        || feature?.properties?.Code
        || feature?.properties?.code
        || '';
      return String(raw).trim().toUpperCase();
    };

    // Check if container exists
    const mapContainer = document.querySelector(mapSelector);
    if (!mapContainer) {
      console.warn('Map container not found:', mapSelector);
      return;
    }

    // Include ALL countries but only attach data to selected ones
    const allFeaturesWithData = state.geoData.features.map((feature) => {
      const code = (feature.id || feature.properties.ISO_A3 || feature.properties.iso_a3 
                 || feature.properties.Code || feature.properties.code || '').toUpperCase();
      const isSelected = state.selectedCodes.has(code);
      
      let countryData = {};
      
      // Only build year data for selected countries
      if (isSelected) {
        state.years.forEach((yr) => {
          const rowForYear = (state.yearIndex.get(yr) || [])
            .find((row) => row.code.toUpperCase() === code);
          if (rowForYear) {
            countryData[yr] = {
              actual: rowForYear.actual,
              projected: rowForYear.projected
            };
          }
        });
      }

      return {
        ...feature,
        properties: {
          ...feature.properties,
          data: countryData
        }
      };
    });

    // Create GeoJSON with all countries (selected have data, unselected don't)
    const geoDataWithAll = {
      ...state.geoData,
      features: allFeaturesWithData
    };

    console.log('All features count:', allFeaturesWithData.length, 'Selected codes:', Array.from(state.selectedCodes));

    // Create or update the choropleth map
    if (!state.choroplethMap) {
      d3.select(mapSelector).selectAll('*').remove();

      state.choroplethMap = new MapClass({
        parentElement: mapSelector,
        valueProperty: 'data',
        valueKey: 'actual',
        legendTitle: cfg.actualColumn,
        entityColumn: cfg.entityColumn,
        codeColumn: cfg.codeColumn,
        containerWidth: 900,
        containerHeight: 350,
        hideYearControls: true
      }, geoDataWithAll);

      // Set years and update the map
      state.choroplethMap.setYears(state.years);
      state.choroplethMap.currentYearIndex = state.yearPos;
      state.choroplethMap.updateVis(); // This sets up colors, legend, and renders
    } else {
      // Update existing map data
      state.choroplethMap.data = geoDataWithAll;
      state.choroplethMap.currentYearIndex = state.yearPos;
      state.choroplethMap.updateVis(); // Update colors and render with new data
    }

    d3.select(mapSelector)
      .selectAll('path.country')
      .style('cursor', 'pointer')
      .on('click.linkedToggle', (event, feature) => {
        event.stopPropagation();
        const code = resolveFeatureCode(feature);
        if (!code) return;
        toggleCountrySelection(state, code);
      });
  }

  function render(state) {
    drawScatterplot(state);
    drawBarchart(state);
    drawChoroplethMap(state);

    const year = state.years[state.yearPos];
    const yearInput = document.querySelector(state.config.yearInputSelector);
    const yearLabel = document.querySelector(state.config.yearLabelSelector);

    if (yearInput) yearInput.value = String(year);
    if (yearLabel) yearLabel.textContent = `Available years: ${state.years[0]}–${state.years[state.years.length - 1]}`;
  }

  function ensureYearControls(state) {
    const cfg = state.config;
    let host = document.querySelector(cfg.yearControlsHostSelector);
    if (!host) {
      const fallbackParent = document.querySelector(cfg.scatterplotSelector)?.parentElement
        || document.querySelector(cfg.barchartSelector)?.parentElement
        || document.body;
      host = document.createElement('div');
      host.id = cfg.yearControlsHostSelector.replace('#', '');
      fallbackParent.insertBefore(host, fallbackParent.firstChild);
    }

    host.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'variable-wrapper';
    wrap.style.justifyContent = 'flex-start';
    wrap.style.marginBottom = '14px';

    const inputContainer = document.createElement('div');
    inputContainer.className = 'variable-container';

    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'Year:';
    inputLabel.setAttribute('for', cfg.yearInputSelector.replace('#', ''));
    inputLabel.className = 'variable-label';

    const yearInput = document.createElement('input');
    yearInput.type = 'number';
    yearInput.id = cfg.yearInputSelector.replace('#', '');
    yearInput.className = 'variable-select';
    yearInput.min = String(state.years[0]);
    yearInput.max = String(state.years[state.years.length - 1]);
    yearInput.value = String(state.years[state.yearPos]);
    yearInput.style.minWidth = '140px';

    const yearLabel = document.createElement('span');
    yearLabel.id = cfg.yearLabelSelector.replace('#', '');
    yearLabel.className = 'variable-output';
    yearLabel.style.minWidth = '220px';
    yearLabel.textContent = `Available years: ${state.years[0]}–${state.years[state.years.length - 1]}`;

    inputContainer.appendChild(inputLabel);
    inputContainer.appendChild(yearInput);
    wrap.appendChild(inputContainer);
    wrap.appendChild(yearLabel);
    host.appendChild(wrap);

    const applyTypedYear = (typedYear) => {
      if (!Number.isFinite(typedYear)) {
        yearInput.value = String(state.years[state.yearPos]);
        return;
      }
      state.yearPos = nearestYearIndex(state.years, typedYear);
      render(state);
    };

    yearInput.addEventListener('change', (event) => {
      applyTypedYear(+event.target.value);
    });

    yearInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        applyTypedYear(+event.target.value);
      }
    });
  }

  function attachCountrySelector(state) {
    const cfg = state.config;

    if (cfg.useExistingCountrySelector) {
      const container = document.querySelector(cfg.countryFilterSelector);
      if (!container) {
        render(state);
        return () => {};
      }

      const syncFromDom = () => {
        const checked = Array.from(container.querySelectorAll('input.country-checkbox:checked'))
          .map((input) => input.value)
          .filter(Boolean);
        state.selectedCodes = new Set(checked);
        render(state);
      };

      const onChange = (event) => {
        if (event.target && event.target.matches('input.country-checkbox')) {
          syncFromDom();
        }
      };

      container.addEventListener('change', onChange);

      const observer = new MutationObserver(() => {
        syncFromDom();
      });
      observer.observe(container, { childList: true, subtree: true });

      syncFromDom();

      return () => {
        container.removeEventListener('change', onChange);
        observer.disconnect();
      };
    }

    if (!window.CountrySelector || typeof window.CountrySelector.init !== 'function') {
      render(state);
      return () => {};
    }

    d3.select(cfg.countryFilterSelector).selectAll('*').remove();

    window.CountrySelector.init(
      state.rows,
      cfg.countryFilterSelector,
      (selectedCodes) => {
        state.selectedCodes = new Set((selectedCodes || []).filter(Boolean));
        render(state);
      },
      cfg.defaultSelectedCodes || []
    );

    state.selectedCodes = new Set((cfg.defaultSelectedCodes || []).filter(Boolean));
    render(state);

    return () => {};
  }

  function attachResize(state) {
    const resizeHandler = () => render(state);
    window.addEventListener('resize', resizeHandler);
    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }

  function withDefaults(config) {
    return {
      csvPath: config.csvPath,
      scatterplotSelector: config.scatterplotSelector || '#scatterplot',
      barchartSelector: config.barchartSelector || '#barchart',
      countryFilterSelector: config.countryFilterSelector || '#country-filters',
      yearControlsHostSelector: config.yearControlsHostSelector || '#year-controls-host',
      yearInputSelector: config.yearInputSelector || '#linked-year-input',
      yearLabelSelector: config.yearLabelSelector || '#linked-year-label',
      choroplethSelector: config.choroplethSelector || '#linked-choropleth-map',
      geoDataPath: config.geoDataPath || '../data/worldgeo.json',
      entityColumn: config.entityColumn || 'Entity',
      codeColumn: config.codeColumn || 'Code',
      yearColumn: config.yearColumn || 'Year',
      actualColumn: config.actualColumn,
      projectedColumn: config.projectedColumn,
      defaultSelectedCodes: config.defaultSelectedCodes || ['USA', 'CHN', 'IND'],
      useExistingCountrySelector: !!config.useExistingCountrySelector,
      scatterHeight: config.scatterHeight || 300,
      barHeight: config.barHeight || 300
    };
  }

  async function init(userConfig) {
    const config = withDefaults(userConfig || {});

    if (!config.csvPath) {
      throw new Error('Missing required config: csvPath');
    }
    if (!config.actualColumn) {
      throw new Error('Missing required config: actualColumn');
    }

    const rawRows = await d3.csv(config.csvPath);
    const rows = normalizeRows(rawRows, config);
    const state = createState(config, rows);

    if (state.years.length === 0) {
      throw new Error('No valid rows found for the configured columns.');
    }

    // Load geoData for choropleth map
    let geoData = null;
    try {
      geoData = await d3.json(config.geoDataPath);
      state.geoData = geoData;
    } catch (err) {
      console.warn('Could not load geoData for choropleth map:', err);
    }

    ensureYearControls(state);
    const detachCountrySelector = attachCountrySelector(state);

    const detachResize = attachResize(state);

    return {
      destroy: () => {
        detachCountrySelector();
        detachResize();
        d3.select(config.choroplethSelector).selectAll('*').remove();
        state.choroplethMap = null;
      },
      setYearIndex: (yearIndex) => {
        const idx = Math.max(0, Math.min(state.years.length - 1, yearIndex));
        state.yearPos = idx;
        render(state);
      },
      getYear: () => state.years[state.yearPos],
      getSelectedCodes: () => Array.from(state.selectedCodes)
    };
  }

  window.HighlightedCountryCharts = {
    init
  };
})();
