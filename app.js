// ============================================================
//  Pokemon Interactive Dashboard — app.js
//  Interactions: Select, Filter, Encode, Connect,
//                Reconfigure, Elaborate, Abstract
// ============================================================

// ---------- State ----------
let data = [];          // all rows (including Shiny)
let coreData = [];      // non-Shiny only (used for Top-15)
let state = {
    filterType:    'All',      // Filter
    xVar:          'attack',   // Encode (scatterplot X)
    yVar:          'defense',  // Encode (scatterplot Y)
    barStat:       'attack',   // Encode (top bar chart stat)
    sortMode:      'Count',    // Reconfigure (type-count bar order)
    isAbstract:    false,      // Abstract
    selectedId:    null,       // Select
    mainChartType: 'scatter'   // Reconfigure (main chart)
};

// Map from dropdown label → data key
const statKeyMap = {
    'Attack':  'attack',
    'Defense': 'defense',
    'HP':      'hp',
    'Speed':   'speed',
    'Sp. Atk': 'spAtk',
    'Sp. Def': 'spDef',
    'Total':   'total'
};

const typeColors = {
    'Normal':  'var(--type-normal)',  'Fire':    'var(--type-fire)',
    'Water':   'var(--type-water)',   'Electric':'var(--type-electric)',
    'Grass':   'var(--type-grass)',   'Ice':     'var(--type-ice)',
    'Fighting':'var(--type-fighting)','Poison':  'var(--type-poison)',
    'Ground':  'var(--type-ground)',  'Flying':  'var(--type-flying)',
    'Psychic': 'var(--type-psychic)', 'Bug':     'var(--type-bug)',
    'Rock':    'var(--type-rock)',    'Ghost':   'var(--type-ghost)',
    'Dragon':  'var(--type-dragon)', 'Dark':    'var(--type-dark)',
    'Steel':   'var(--type-steel)',   'Fairy':   'var(--type-fairy)'
};

// SVG handles
const tooltip = d3.select('#tooltip');
let scatterSvg, barSvg, topBarSvg;
let scatterX, scatterY, barX, barY;

// ============================================================
//  Helpers
// ============================================================

/** Fix names like "CharizardMega Charizard Y" → "Mega Charizard Y"
 *  by stripping a leading word that is wholly contained in the remainder. */
function cleanName(raw) {
    // If the name contains '(' it was already clean or is a Shiny label
    if (raw.includes('(Shiny)')) return raw.replace('(Shiny)', '').trim() + ' ✦';
    // Detect "BaseFormName" concatenation: word boundary check
    const match = raw.match(/^([A-Z][a-z]+)([A-Z].+)$/);
    if (match) {
        const prefix = match[1];   // e.g. "Charizard"
        const rest   = match[2];   // e.g. "Mega Charizard Y"
        // Only strip prefix if it genuinely appears in the rest part
        if (rest.includes(prefix)) return rest;
    }
    return raw;
}

/** Truncate a string to maxLen characters with ellipsis */
function trunc(s, maxLen = 22) {
    return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

// ============================================================
//  BOOT
// ============================================================
d3.csv('Pokemon_data.csv').then(raw => {
    data = raw.map((d, i) => {
        const rawName = d.Name;
        const isShiny = rawName.includes('(Shiny)');
        const displayName = cleanName(rawName);
        return {
            rowIdx:     i,                         // guaranteed-unique key
            name:       displayName,               // cleaned display name
            rawName:    rawName,                   // original for debugging
            isShiny:    isShiny,
            type1:      d['Type 1'],
            type2:      d['Type 2'] || '',
            total:      +d.Total,
            hp:         +d.HP,
            attack:     +d.Attack,
            defense:    +d.Defense,
            spAtk:      +d['Sp. Atk'],
            spDef:      +d['Sp. Def'],
            speed:      +d.Speed,
            generation: +d.Generation,
            legendary:  d.Legendary === 'True'
        };
    });

    // coreData excludes Shiny — used for Top-15 to avoid duplicates
    coreData = data.filter(d => !d.isShiny);

    // Populate Filter dropdown from all real types
    const types = Array.from(new Set(coreData.map(d => d.type1))).sort();
    const filterSel = d3.select('#type-filter');
    types.forEach(t => filterSel.append('option').text(t).attr('value', t));

    initCharts();
    setupEventListeners();
    updateAll();
});

// ============================================================
//  INIT CHARTS  — build SVG scaffolding once
// ============================================================
function initCharts() {
    // ---- Scatterplot ----
    const sNode = d3.select('#scatterplot').node();
    const sR    = sNode.getBoundingClientRect();
    const sM    = {top:20, right:20, bottom:55, left:60};
    const sW    = sR.width  - sM.left - sM.right;
    const sH    = sR.height - sM.top  - sM.bottom;

    scatterSvg = d3.select('#scatterplot').append('svg')
        .attr('width','100%').attr('height','100%')
        .attr('viewBox', `0 0 ${sR.width} ${sR.height}`)
        .append('g').attr('transform', `translate(${sM.left},${sM.top})`);

    scatterSvg.append('g').attr('class','x-axis').attr('transform',`translate(0,${sH})`);
    scatterSvg.append('g').attr('class','y-axis');
    scatterSvg.append('text').attr('class','axis-label x-label')
        .attr('x', sW/2).attr('y', sH+45)
        .attr('text-anchor','middle').attr('fill','var(--text-muted)').attr('font-size','12px');
    scatterSvg.append('text').attr('class','axis-label y-label')
        .attr('transform','rotate(-90)')
        .attr('x', -sH/2).attr('y', -48)
        .attr('text-anchor','middle').attr('fill','var(--text-muted)').attr('font-size','12px');

    // Background click → deselect  (Select interaction)
    scatterSvg.append('rect')
        .attr('width', sW).attr('height', sH)
        .attr('fill','transparent')
        .on('click', () => { state.selectedId = null; updateScatterplot(); });

    // ---- Type-count bar chart ----
    const bNode = d3.select('#barchart').node();
    const bR    = bNode.getBoundingClientRect();
    const bM    = {top:15, right:15, bottom:65, left:45};
    const bW    = bR.width  - bM.left - bM.right;
    const bH    = bR.height - bM.top  - bM.bottom;

    barSvg = d3.select('#barchart').append('svg')
        .attr('width','100%').attr('height','100%')
        .attr('viewBox', `0 0 ${bR.width} ${bR.height}`)
        .append('g').attr('transform', `translate(${bM.left},${bM.top})`);

    barSvg.append('g').attr('class','x-axis').attr('transform',`translate(0,${bH})`);
    barSvg.append('g').attr('class','y-axis');

    // ---- Top-15 horizontal bar chart ----
    const tNode = d3.select('#topbarchart').node();
    const tR    = tNode.getBoundingClientRect();
    const tM    = {top:15, right:40, bottom:50, left:185};
    const tW    = (tR.width  || 760) - tM.left - tM.right;
    const tH    = (tR.height || 420) - tM.top  - tM.bottom;

    topBarSvg = d3.select('#topbarchart').append('svg')
        .attr('width','100%').attr('height','100%')
        .attr('viewBox', `0 0 ${tR.width||760} ${tR.height||420}`)
        .append('g').attr('transform', `translate(${tM.left},${tM.top})`);

    topBarSvg.append('g').attr('class','x-axis').attr('transform',`translate(0,${tH})`);
    topBarSvg.append('g').attr('class','y-axis');
    topBarSvg.append('text').attr('class','axis-label tb-xlabel')
        .attr('x', tW/2).attr('y', tH+42)
        .attr('text-anchor','middle').attr('fill','var(--text-muted)').attr('font-size','12px');
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
function setupEventListeners() {
    // FILTER
    d3.select('#type-filter').on('change', function() {
        state.filterType = this.value;
        updateAll();
    });

    // ENCODE — scatterplot X
    d3.select('#x-axis-select').on('change', function() {
        state.xVar = statKeyMap[this.value] || 'attack';
        updateScatterplot();
        if (state.mainChartType === 'bar') updateTopBarchart();
    });

    // ENCODE — scatterplot Y
    d3.select('#y-axis-select').on('change', function() {
        state.yVar = statKeyMap[this.value] || 'defense';
        updateScatterplot();
    });

    // ENCODE — Top-15 bar stat
    d3.select('#bar-stat-select').on('change', function() {
        state.barStat = statKeyMap[this.value] || 'attack';
        if (state.mainChartType === 'bar') updateTopBarchart();
    });

    // RECONFIGURE — main chart type
    d3.select('#main-chart-select').on('change', function() {
        state.mainChartType = this.value;
        const isBar = state.mainChartType === 'bar';
        d3.select('#scatterplot').classed('hidden', isBar);
        d3.select('#topbarchart').classed('hidden', !isBar);
        d3.select('#scatter-encode-controls').classed('hidden', isBar);
        d3.select('#bar-encode-control').classed('hidden', !isBar);
        const statLabel = isBar ? d3.select('#bar-stat-select').node().value : '';
        d3.select('#main-chart-title').text(
            isBar ? `Top 15 Pokémon by ${statLabel}` : 'Pokémon Stats Comparison'
        );
        if (isBar) updateTopBarchart(); else updateScatterplot();
    });

    // RECONFIGURE — sort for type-count bar
    d3.select('#sort-select').on('change', function() {
        state.sortMode = this.value;
        updateBarchart();
    });

    // ABSTRACT — toggle aggregated view
    d3.select('#toggle-view').on('click', function() {
        state.isAbstract = !state.isAbstract;
        d3.select(this).text(state.isAbstract ? 'Show Individual View' : 'Show Aggregated View');
        updateScatterplot();
    });
}

// ============================================================
//  UPDATE ALL
// ============================================================
function updateAll() {
    updateScatterplot();
    updateBarchart();
    if (state.mainChartType === 'bar') updateTopBarchart();
}

// ============================================================
//  SCATTERPLOT  (Select, Encode, Filter, Abstract, Elaborate)
// ============================================================
function updateScatterplot() {
    const sRect = d3.select('#scatterplot').node().getBoundingClientRect();
    const sM    = {top:20, right:20, bottom:55, left:60};
    const W     = sRect.width  - sM.left - sM.right;
    const H     = sRect.height - sM.top  - sM.bottom;

    // FILTER — use full data including Shiny in scatterplot (shows more spread)
    let disp = state.filterType === 'All' ? data : data.filter(d => d.type1 === state.filterType);

    // ENCODE — scales
    scatterX = d3.scaleLinear()
        .domain([0, (d3.max(disp, d => d[state.xVar]) || 200) * 1.05])
        .range([0, W]);
    scatterY = d3.scaleLinear()
        .domain([0, (d3.max(disp, d => d[state.yVar]) || 200) * 1.05])
        .range([H, 0]);

    scatterSvg.select('.x-axis').transition().duration(500).call(d3.axisBottom(scatterX).ticks(6));
    scatterSvg.select('.y-axis').transition().duration(500).call(d3.axisLeft(scatterY).ticks(6));
    scatterSvg.select('.x-label').text(d3.select('#x-axis-select').node().value);
    scatterSvg.select('.y-label').text(d3.select('#y-axis-select').node().value);

    // ABSTRACT — aggregate by type
    if (state.isAbstract) {
        const rollup = d3.rollup(disp,
            v => ({
                xAvg: d3.mean(v, d => d[state.xVar]),
                yAvg: d3.mean(v, d => d[state.yVar]),
                count: v.length,
                type: v[0].type1
            }),
            d => d.type1
        );
        disp = Array.from(rollup.values());
    }

    const dots = scatterSvg.selectAll('.dot')
        .data(disp, d => state.isAbstract ? d.type : d.rowIdx);

    dots.exit().transition().duration(300).attr('r', 0).remove();

    const enter = dots.enter().append('circle')
        .attr('class', 'dot')
        .attr('r', 0)
        .attr('cx', d => scatterX(state.isAbstract ? d.xAvg : d[state.xVar]))
        .attr('cy', d => scatterY(state.isAbstract ? d.yAvg : d[state.yVar]))
        .attr('fill', d => {
            if (state.isAbstract) return typeColors[d.type] || '#aaa';
            if (d.isShiny) return '#FFD700';
            return typeColors[d.type1] || '#aaa';
        })
        .attr('opacity', 0.8)
        // ELABORATE
        .on('mouseover', showTooltip)
        .on('mousemove', moveTooltip)
        .on('mouseout',  hideTooltip)
        // SELECT
        .on('click', function(event, d) {
            if (state.isAbstract) return;
            state.selectedId = (state.selectedId === d.rowIdx) ? null : d.rowIdx;
            updateScatterplot();
            event.stopPropagation();
        });

    dots.merge(enter)
        .transition().duration(750)
        .attr('cx', d => scatterX(state.isAbstract ? d.xAvg : d[state.xVar]))
        .attr('cy', d => scatterY(state.isAbstract ? d.yAvg : d[state.yVar]))
        .attr('r', d => {
            if (state.isAbstract) return Math.sqrt(d.count) * 4 + 5;
            return d.isShiny ? 7 : 5;
        })
        .attr('class', d => {
            if (state.isAbstract) return 'dot';
            if (state.selectedId !== null && d.rowIdx !== state.selectedId) return 'dot dimmed';
            if (d.rowIdx === state.selectedId) return 'dot selected';
            return 'dot';
        });
}

// ============================================================
//  TYPE-COUNT BAR CHART  (Connect, Reconfigure, Filter)
// ============================================================
function updateBarchart() {
    const bRect = d3.select('#barchart').node().getBoundingClientRect();
    const bM    = {top:15, right:15, bottom:65, left:45};
    const W     = bRect.width  - bM.left - bM.right;
    const H     = bRect.height - bM.top  - bM.bottom;

    // Count from coreData only (no Shiny duplicates in type-count chart)
    let typeCounts = Array.from(
        d3.rollup(coreData, v => v.length, d => d.type1),
        ([type, count]) => ({type, count})
    );

    // RECONFIGURE — sort order
    if (state.sortMode === 'Count') {
        typeCounts.sort((a, b) => d3.descending(a.count, b.count));
    } else {
        typeCounts.sort((a, b) => d3.ascending(a.type, b.type));
    }

    barX = d3.scaleBand().domain(typeCounts.map(d => d.type)).range([0, W]).padding(0.2);
    barY = d3.scaleLinear().domain([0, d3.max(typeCounts, d => d.count)]).range([H, 0]);

    barSvg.select('.x-axis')
        .transition().duration(500)
        .call(d3.axisBottom(barX))
        .selectAll('text')
        .attr('transform','rotate(-45)')
        .style('text-anchor','end')
        .attr('dx','-0.5em').attr('dy','0.15em');

    barSvg.select('.y-axis').transition().duration(500).call(d3.axisLeft(barY).ticks(5));

    const bars = barSvg.selectAll('.bar').data(typeCounts, d => d.type);
    bars.exit().remove();

    bars.enter().append('rect')
        .attr('class', 'bar')
        .attr('x',      d => barX(d.type))
        .attr('y',      H)
        .attr('width',  barX.bandwidth())
        .attr('height', 0)
        .attr('fill',   d => typeColors[d.type] || '#aaa')
        // CONNECT — hover dims scatterplot dots of other types
        .on('mouseover', function(event, d) {
            d3.select(this).style('filter','brightness(1.3)');
            scatterSvg.selectAll('.dot').classed('dimmed', p => {
                const pt = state.isAbstract ? p.type : p.type1;
                return pt !== d.type;
            });
        })
        .on('mouseout', function() {
            d3.select(this).style('filter','none');
            scatterSvg.selectAll('.dot').classed('dimmed', false);
        })
        // FILTER shortcut — click a type to filter
        .on('click', function(event, d) {
            const newFilter = state.filterType === d.type ? 'All' : d.type;
            state.filterType = newFilter;
            d3.select('#type-filter').node().value = newFilter;
            updateAll();
        })
        .merge(bars)
        .transition().duration(750)
        .attr('x',      d => barX(d.type))
        .attr('y',      d => barY(d.count))
        .attr('width',  barX.bandwidth())
        .attr('height', d => H - barY(d.count))
        .attr('opacity', d => state.filterType === 'All' || state.filterType === d.type ? 1 : 0.35);
}

// ============================================================
//  TOP-15 HORIZONTAL BAR CHART  (Reconfigure, Encode, Filter, Elaborate, Select)
// ============================================================
function updateTopBarchart() {
    const tNode = d3.select('#topbarchart').node();
    if (!tNode) return;
    const tR = tNode.getBoundingClientRect();
    const tM = {top:15, right:40, bottom:50, left:185};
    const W  = (tR.width  || 760) - tM.left - tM.right;
    const H  = (tR.height || 420) - tM.top  - tM.bottom;

    // Use coreData only — no Shiny duplicates
    let pool = state.filterType === 'All' ? coreData : coreData.filter(d => d.type1 === state.filterType);

    // Sort by chosen stat descending, keep top 15 — stable sort by rowIdx as tiebreaker
    const sorted = [...pool].sort((a, b) =>
        b[state.barStat] - a[state.barStat] || a.rowIdx - b.rowIdx
    );
    const top15 = sorted.slice(0, 15);

    const statLabel = d3.select('#bar-stat-select').node().value;
    d3.select('#main-chart-title').text(`Top 15 Pokémon by ${statLabel}`);
    topBarSvg.select('.tb-xlabel').text(statLabel);

    // ENCODE — scales built from this exact dataset
    const maxVal = d3.max(top15, d => d[state.barStat]) || 200;
    const xScale = d3.scaleLinear().domain([0, maxVal * 1.08]).range([0, W]);

    // Use rowIdx as the Y-domain key so each bar is truly unique
    const yScale = d3.scaleBand()
        .domain(top15.map(d => d.rowIdx))
        .range([0, H])
        .padding(0.25);

    topBarSvg.select('.x-axis')
        .transition().duration(500)
        .call(d3.axisBottom(xScale).ticks(6));

    // Custom Y-axis: render cleaned, truncated names (not rowIdx numbers)
    topBarSvg.select('.y-axis')
        .transition().duration(500)
        .call(d3.axisLeft(yScale).tickFormat(idx => {
            const d = top15.find(r => r.rowIdx === idx);
            return d ? trunc(d.name, 22) : idx;
        }));

    // Bars — keyed by rowIdx (guaranteed unique)
    const bars = topBarSvg.selectAll('.top-bar').data(top15, d => d.rowIdx);

    bars.exit().transition().duration(300).attr('width', 0).remove();

    const enter = bars.enter().append('rect')
        .attr('class', 'top-bar')
        .attr('y',      d => yScale(d.rowIdx))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width', 0)
        .attr('fill',   d => typeColors[d.type1] || '#aaa')
        .attr('rx', 3)
        .on('mouseover', (event, d) => showTooltipIndividual(event, d))
        .on('mousemove', moveTooltip)
        .on('mouseout',  hideTooltip)
        .on('click', function(event, d) {
            state.selectedId = (state.selectedId === d.rowIdx) ? null : d.rowIdx;
            updateTopBarchart();
        });

    bars.merge(enter)
        .transition().duration(750)
        .attr('y',      d => yScale(d.rowIdx))
        .attr('height', yScale.bandwidth())
        .attr('x', 0)
        .attr('width',  d => xScale(d[state.barStat]))   // <-- directly maps the actual stat value
        .attr('opacity', d => !state.selectedId || d.rowIdx === state.selectedId ? 0.9 : 0.35);

    // Value labels at the end of each bar
    const labels = topBarSvg.selectAll('.bar-val').data(top15, d => d.rowIdx);
    labels.exit().remove();
    labels.enter().append('text')
        .attr('class','bar-val')
        .merge(labels)
        .transition().duration(750)
        .attr('x', d => xScale(d[state.barStat]) + 5)
        .attr('y', d => yScale(d.rowIdx) + yScale.bandwidth() / 2 + 4)
        .attr('fill','var(--text-muted)')
        .attr('font-size','11px')
        .text(d => d[state.barStat]);
}

// ============================================================
//  TOOLTIP helpers  (Elaborate interaction)
// ============================================================
function buildTooltipHTML(d) {
    const tColor  = typeColors[d.type1] || '#555';
    const t2Color = d.type2 ? (typeColors[d.type2] || '#555') : null;
    return `
        <div class="tooltip-title">
            ${d.name}
            <span class="tooltip-type" style="background:${tColor};color:#111">${d.type1}</span>
            ${t2Color ? `<span class="tooltip-type" style="background:${t2Color};color:#111">${d.type2}</span>` : ''}
        </div>
        <div class="tooltip-stats">
            <div class="stat-row"><span class="stat-label">Gen</span><span class="stat-val">${d.generation}</span></div>
            <div class="stat-row"><span class="stat-label">Total</span><span class="stat-val">${d.total}</span></div>
            <div class="stat-row"><span class="stat-label">HP</span><span class="stat-val">${d.hp}</span></div>
            <div class="stat-row"><span class="stat-label">Attack</span><span class="stat-val">${d.attack}</span></div>
            <div class="stat-row"><span class="stat-label">Defense</span><span class="stat-val">${d.defense}</span></div>
            <div class="stat-row"><span class="stat-label">Sp. Atk</span><span class="stat-val">${d.spAtk}</span></div>
            <div class="stat-row"><span class="stat-label">Sp. Def</span><span class="stat-val">${d.spDef}</span></div>
            <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-val">${d.speed}</span></div>
            ${d.legendary ? '<div class="stat-row" style="grid-column:1/-1"><span class="stat-label" style="color:#F59E0B">★ Legendary</span></div>' : ''}
            ${d.isShiny   ? '<div class="stat-row" style="grid-column:1/-1"><span class="stat-label" style="color:#FFD700">✦ Shiny Variant</span></div>' : ''}
        </div>`;
}

function showTooltip(event, d) {
    if (state.isAbstract) {
        tooltip.html(`
            <div class="tooltip-title">${d.type} Type</div>
            <div class="tooltip-stats">
                <div class="stat-row"><span class="stat-label">Count</span><span class="stat-val">${d.count}</span></div>
                <div class="stat-row"><span class="stat-label">Avg ${d3.select('#x-axis-select').node().value}</span><span class="stat-val">${Math.round(d.xAvg)}</span></div>
                <div class="stat-row"><span class="stat-label">Avg ${d3.select('#y-axis-select').node().value}</span><span class="stat-val">${Math.round(d.yAvg)}</span></div>
            </div>`);
    } else {
        tooltip.html(buildTooltipHTML(d));
    }
    tooltip.classed('hidden', false)
        .style('left', (event.pageX + 14) + 'px')
        .style('top',  (event.pageY - 14) + 'px');
}

function showTooltipIndividual(event, d) {
    tooltip.html(buildTooltipHTML(d));
    tooltip.classed('hidden', false)
        .style('left', (event.pageX + 14) + 'px')
        .style('top',  (event.pageY - 14) + 'px');
}

function moveTooltip(event) {
    tooltip.style('left', (event.pageX + 14) + 'px')
           .style('top',  (event.pageY - 14) + 'px');
}

function hideTooltip() {
    tooltip.classed('hidden', true);
}
