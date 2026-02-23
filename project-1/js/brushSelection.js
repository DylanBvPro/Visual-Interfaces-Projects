(function () {
    function defaultKey(d) {
        return d.code || d.Code || d.entity || d.Entity || d.trail || d.name || d.Name;
    }

    function enableScatterplotBrush(vis, circles, options = {}) {
        if (!vis || !vis.chart || !circles) return;

        const getX = options.getX;
        const getY = options.getY;
        const keyFn = options.keyFn || defaultKey;
        const hideClass = options.hideClass || 'brush-hidden';

        if (!getX || !getY) return;

        vis.chart.selectAll('.brush-layer').remove();

        const brush = d3.brush()
            .extent([[0, 0], [vis.width, vis.height]])
            .on('end', brushEnded);

        const brushLayer = vis.chart.append('g')
            .attr('class', 'brush-layer')
            .call(brush);

        // Place the brush below points so circles stay interactive
        brushLayer.lower();

        brushLayer.selectAll('.overlay')
            .style('cursor', 'crosshair');

        function brushEnded(event) {
            if (!event.selection) {
                return;
            }
            const selectedKeys = updateSelection(event.selection);
            const selectedList = Array.from(selectedKeys);
            if (window.CountrySelector && typeof window.CountrySelector.setSelected === 'function') {
                window.CountrySelector.setSelected(selectedList, true);
            }
        }

        function updateSelection(selection) {
            const [[x0, y0], [x1, y1]] = selection;
            const selectedKeys = new Set();

            circles.each(function (d) {
                const cx = getX(d);
                const cy = getY(d);
                if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
                    selectedKeys.add(keyFn(d));
                }
            });

            circles.each(function (d) {
                const keep = selectedKeys.has(keyFn(d));
                d3.select(this)
                    .classed(hideClass, !keep)
                    .style('display', keep ? null : 'none');
            });

            return selectedKeys;
        }
    }

    window.enableScatterplotBrush = enableScatterplotBrush;
})();
