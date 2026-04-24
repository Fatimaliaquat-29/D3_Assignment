// Configuration and State
let data = [];
let state = {
    filterType: 'All', // Filter interaction
    xVar: 'Attack',    // Encode interaction
    yVar: 'Defense',   // Encode interaction
    sortMode: 'Count', // Reconfigure interaction
    isAbstract: false, // Abstract interaction
    selectedPokemon: null, // Select interaction
    mainChartType: 'scatter'
};

const typeColors = {
    'Normal': 'var(--type-normal)', 'Fire': 'var(--type-fire)', 'Water': 'var(--type-water)',
    'Electric': 'var(--type-electric)', 'Grass': 'var(--type-grass)', 'Ice': 'var(--type-ice)',
    'Fighting': 'var(--type-fighting)', 'Poison': 'var(--type-poison)', 'Ground': 'var(--type-ground)',
    'Flying': 'var(--type-flying)', 'Psychic': 'var(--type-psychic)', 'Bug': 'var(--type-bug)',
    'Rock': 'var(--type-rock)', 'Ghost': 'var(--type-ghost)', 'Dragon': 'var(--type-dragon)',
    'Dark': 'var(--type-dark)', 'Steel': 'var(--type-steel)', 'Fairy': 'var(--type-fairy)'
};

// DOM Elements
const tooltip = d3.select('#tooltip');
let scatterSvg, barSvg, topBarSvg;
let scatterX, scatterY, barX, barY, topBarX, topBarY;

// Initialize
d3.csv('Pokemon_data.csv').then(raw => {
    // Clean and parse data
    data = raw.map(d => ({
        id: +d['#'],
        name: d.Name,
        type1: d['Type 1'],
        type2: d['Type 2'],
        total: +d.Total,
        hp: +d.HP,
        attack: +d.Attack,
        defense: +d.Defense,
        spAtk: +d['Sp. Atk'],
        spDef: +d['Sp. Def'],
        speed: +d.Speed,
        generation: +d.Generation,
        legendary: d.Legendary === 'True'
    }));

    // Populate Filter Dropdown
    const types = Array.from(new Set(data.map(d => d.type1))).sort();
    const filterSelect = d3.select('#type-filter');
    types.forEach(t => filterSelect.append('option').text(t).attr('value', t));

    initCharts();
    setupEventListeners();
    updateAll();
});

function initCharts() {
    // Scatterplot setup
    const scatterContainer = d3.select('#scatterplot').node();
    const scatterRect = scatterContainer.getBoundingClientRect();
    const sMargin = {top: 20, right: 20, bottom: 50, left: 60};
    const sWidth = scatterRect.width - sMargin.left - sMargin.right;
    const sHeight = scatterRect.height - sMargin.top - sMargin.bottom;

    scatterSvg = d3.select('#scatterplot').append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${scatterRect.width} ${scatterRect.height}`)
        .append('g')
        .attr('transform', `translate(${sMargin.left},${sMargin.top})`);

    // Axes groups
    scatterSvg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${sHeight})`);
    scatterSvg.append('g').attr('class', 'y-axis');
    
    // Axis labels
    scatterSvg.append('text').attr('class', 'x-label')
        .attr('x', sWidth / 2).attr('y', sHeight + 40)
        .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)');
    scatterSvg.append('text').attr('class', 'y-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -sHeight / 2).attr('y', -45)
        .attr('text-anchor', 'middle').attr('fill', 'var(--text-muted)');

    // Click background to deselect (Select interaction)
    scatterSvg.append('rect')
        .attr('width', sWidth).attr('height', sHeight)
        .attr('fill', 'transparent')
        .on('click', () => {
            state.selectedPokemon = null;
            updateScatterplot();
        });

    // Bar chart setup
    const barContainer = d3.select('#barchart').node();
    const barRect = barContainer.getBoundingClientRect();
    const bMargin = {top: 20, right: 20, bottom: 60, left: 50};
    
    barSvg = d3.select('#barchart').append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${barRect.width} ${barRect.height}`)
        .append('g')
        .attr('transform', `translate(${bMargin.left},${bMargin.top})`);
        
    barSvg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${barRect.height - bMargin.top - bMargin.bottom})`);
    barSvg.append('g').attr('class', 'y-axis');

    const topBarContainer = d3.select('#topbarchart').node();
    const tbRect = topBarContainer.getBoundingClientRect();
    const tbMargin = {top: 20, right: 30, bottom: 40, left: 120};
    
    topBarSvg = d3.select('#topbarchart').append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${tbRect.width || 800} ${tbRect.height || 400}`)
        .append('g')
        .attr('transform', `translate(${tbMargin.left},${tbMargin.top})`);
        
    topBarSvg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${(tbRect.height || 400) - tbMargin.top - tbMargin.bottom})`);
    topBarSvg.append('g').attr('class', 'y-axis');
}

function setupEventListeners() {
    d3.select('#type-filter').on('change', function() {
        state.filterType = this.value;
        updateAll(); // Filter interaction
    });

    d3.select('#main-chart-select').on('change', function() {
        state.mainChartType = this.value;
        if (state.mainChartType === 'bar') {
            d3.select('#scatterplot').classed('hidden', true);
            d3.select('#topbarchart').classed('hidden', false);
            d3.select('#main-chart-title').text(`Top 50 by ${d3.select('#x-axis-select').node().value}`);
            updateTopBarchart();
        } else {
            d3.select('#scatterplot').classed('hidden', false);
            d3.select('#topbarchart').classed('hidden', true);
            d3.select('#main-chart-title').text('Pokemon Stats Comparison');
            updateScatterplot();
        }
    });

    d3.select('#x-axis-select').on('change', function() {
        state.xVar = this.value.toLowerCase().replace('. ', '').replace(' ', ''); // Map to data keys roughly
        if(this.value === 'Sp. Atk') state.xVar = 'spAtk';
        if(this.value === 'Sp. Def') state.xVar = 'spDef';
        updateScatterplot(); // Encode interaction
    });

    d3.select('#y-axis-select').on('change', function() {
        state.yVar = this.value.toLowerCase().replace('. ', '').replace(' ', '');
        if(this.value === 'Sp. Atk') state.yVar = 'spAtk';
        if(this.value === 'Sp. Def') state.yVar = 'spDef';
        updateScatterplot(); // Encode interaction
        if(state.mainChartType === 'bar') updateTopBarchart();
    });

    d3.select('#sort-select').on('change', function() {
        state.sortMode = this.value;
        updateBarchart(); // Reconfigure interaction
    });

    d3.select('#toggle-view').on('click', function() {
        state.isAbstract = !state.isAbstract;
        d3.select(this).text(state.isAbstract ? 'Show Individual View' : 'Show Aggregated View');
        updateScatterplot(); // Abstract interaction
    });
}

function updateAll() {
    updateScatterplot();
    updateBarchart();
    if (state.mainChartType === 'bar') updateTopBarchart();
}

function updateScatterplot() {
    const sRect = d3.select('#scatterplot').node().getBoundingClientRect();
    const width = sRect.width - 80;
    const height = sRect.height - 70;

    // Filter interaction
    let displayData = state.filterType === 'All' ? data : data.filter(d => d.type1 === state.filterType);

    // Encode interaction: Scales
    const xMax = d3.max(displayData, d => d[state.xVar]) || 200;
    const yMax = d3.max(displayData, d => d[state.yVar]) || 200;

    scatterX = d3.scaleLinear().domain([0, xMax * 1.05]).range([0, width]);
    scatterY = d3.scaleLinear().domain([0, yMax * 1.05]).range([height, 0]);

    // Update axes
    scatterSvg.select('.x-axis')
        .transition().duration(500)
        .call(d3.axisBottom(scatterX));
    scatterSvg.select('.y-axis')
        .transition().duration(500)
        .call(d3.axisLeft(scatterY));
        
    scatterSvg.select('.x-label').text(d3.select('#x-axis-select').node().value);
    scatterSvg.select('.y-label').text(d3.select('#y-axis-select').node().value);

    // Abstract interaction
    if (state.isAbstract) {
        // Aggregate by Type 1
        const rollup = d3.rollup(displayData, 
            v => ({
                xAvg: d3.mean(v, d => d[state.xVar]),
                yAvg: d3.mean(v, d => d[state.yVar]),
                count: v.length,
                type: v[0].type1
            }), 
            d => d.type1
        );
        displayData = Array.from(rollup.values());
    }

    // Data join
    const circles = scatterSvg.selectAll('.dot')
        .data(displayData, d => state.isAbstract ? d.type : d.id);

    // Exit
    circles.exit().transition().duration(300).attr('r', 0).remove();

    // Enter + Update
    const circlesEnter = circles.enter().append('circle')
        .attr('class', 'dot')
        .attr('r', 0)
        .attr('cx', d => scatterX(state.isAbstract ? d.xAvg : d[state.xVar]))
        .attr('cy', d => scatterY(state.isAbstract ? d.yAvg : d[state.yVar]))
        .attr('fill', d => {
            if (state.isAbstract) return typeColors[d.type] || '#fff';
            return d.name.includes('(Shiny)') ? '#FFD700' : (typeColors[d.type1] || '#fff');
        })
        .attr('opacity', 0.8)
        .on('mouseover', showTooltip) // Elaborate interaction
        .on('mouseout', hideTooltip)
        .on('click', function(event, d) {
            // Select interaction
            if (state.isAbstract) return;
            state.selectedPokemon = d.id;
            updateScatterplot();
            event.stopPropagation();
        });

    circles.merge(circlesEnter)
        .transition().duration(750)
        .attr('cx', d => scatterX(state.isAbstract ? d.xAvg : d[state.xVar]))
        .attr('cy', d => scatterY(state.isAbstract ? d.yAvg : d[state.yVar]))
        .attr('r', d => {
            if (state.isAbstract) return Math.sqrt(d.count) * 4 + 5;
            return d.name.includes('(Shiny)') ? 8 : 5;
        })
        .attr('class', d => {
            if (state.isAbstract) return 'dot';
            return d.id === state.selectedPokemon ? 'dot selected' : 'dot';
        });
}

function updateBarchart() {
    const bRect = d3.select('#barchart').node().getBoundingClientRect();
    const width = bRect.width - 70;
    const height = bRect.height - 80;

    // Filter dataset based on current filter (optional, usually bar chart shows all to allow filtering from it, but let's keep it consistent)
    // Actually, it's better if bar chart always shows all, so we can use it to filter/connect.
    
    let typeCounts = Array.from(d3.rollup(data, v => v.length, d => d.type1), ([type, count]) => ({type, count}));

    // Reconfigure interaction: Sort
    if (state.sortMode === 'Count') {
        typeCounts.sort((a, b) => d3.descending(a.count, b.count));
    } else {
        typeCounts.sort((a, b) => d3.ascending(a.type, b.type));
    }

    barX = d3.scaleBand()
        .domain(typeCounts.map(d => d.type))
        .range([0, width])
        .padding(0.2);

    barY = d3.scaleLinear()
        .domain([0, d3.max(typeCounts, d => d.count)])
        .range([height, 0]);

    barSvg.select('.x-axis')
        .transition().duration(500)
        .call(d3.axisBottom(barX))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    barSvg.select('.y-axis')
        .transition().duration(500)
        .call(d3.axisLeft(barY).ticks(5));

    const bars = barSvg.selectAll('.bar')
        .data(typeCounts, d => d.type);

    bars.exit().remove();

    bars.enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => barX(d.type))
        .attr('y', height)
        .attr('width', barX.bandwidth())
        .attr('height', 0)
        .attr('fill', d => typeColors[d.type])
        .on('mouseover', function(event, d) {
            // Connect interaction
            d3.select(this).style('filter', 'brightness(1.2)');
            scatterSvg.selectAll('.dot')
                .classed('dimmed', p => {
                    const ptType = state.isAbstract ? p.type : p.type1;
                    return ptType !== d.type;
                });
        })
        .on('mouseout', function() {
            // Connect interaction revert
            d3.select(this).style('filter', 'none');
            scatterSvg.selectAll('.dot').classed('dimmed', false);
        })
        .on('click', function(event, d) {
            // Click to filter (Filter interaction shortcut)
            const filterDropdown = d3.select('#type-filter').node();
            filterDropdown.value = d.type;
            state.filterType = d.type;
            updateAll();
        })
        .merge(bars)
        .transition().duration(750)
        .attr('x', d => barX(d.type))
        .attr('y', d => barY(d.count))
        .attr('width', barX.bandwidth())
        .attr('height', d => height - barY(d.count));
}

// Elaborate Interaction
function showTooltip(event, d) {
    if (state.isAbstract) {
        tooltip.html(`
            <div class="tooltip-title">${d.type} Type</div>
            <div class="tooltip-stats">
                <div class="stat-row"><span class="stat-label">Count</span><span class="stat-val">${d.count}</span></div>
                <div class="stat-row"><span class="stat-label">Avg ${d3.select('#x-axis-select').node().value}</span><span class="stat-val">${Math.round(d.xAvg)}</span></div>
                <div class="stat-row"><span class="stat-label">Avg ${d3.select('#y-axis-select').node().value}</span><span class="stat-val">${Math.round(d.yAvg)}</span></div>
            </div>
        `);
    } else {
        const tColor = typeColors[d.type1] || '#fff';
        tooltip.html(`
            <div class="tooltip-title">
                ${d.name}
                <span class="tooltip-type" style="background-color: ${tColor}">${d.type1}</span>
            </div>
            <div class="tooltip-stats">
                <div class="stat-row"><span class="stat-label">Gen</span><span class="stat-val">${d.generation}</span></div>
                <div class="stat-row"><span class="stat-label">Total</span><span class="stat-val">${d.total}</span></div>
                <div class="stat-row"><span class="stat-label">HP</span><span class="stat-val">${d.hp}</span></div>
                <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-val">${d.speed}</span></div>
                <div class="stat-row"><span class="stat-label">Attack</span><span class="stat-val">${d.attack}</span></div>
                <div class="stat-row"><span class="stat-label">Defense</span><span class="stat-val">${d.defense}</span></div>
                <div class="stat-row"><span class="stat-label">Sp. Atk</span><span class="stat-val">${d.spAtk}</span></div>
                <div class="stat-row"><span class="stat-label">Sp. Def</span><span class="stat-val">${d.spDef}</span></div>
            </div>
        `);
    }
    
    tooltip.classed('hidden', false)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 15) + 'px');
}

function hideTooltip() {
    tooltip.classed('hidden', true);
}

// Top Bar Chart Update
function updateTopBarchart() {
    const tbContainer = d3.select('#topbarchart').node();
    if (!tbContainer) return;
    const tbRect = tbContainer.getBoundingClientRect();
    const width = (tbRect.width || 800) - 150;
    const height = (tbRect.height || 400) - 60;

    let displayData = state.filterType === 'All' ? data : data.filter(d => d.type1 === state.filterType);
    displayData = displayData.sort((a, b) => b[state.xVar] - a[state.xVar]).slice(0, 50);

    topBarX = d3.scaleLinear().domain([0, d3.max(displayData, d => d[state.xVar]) || 200]).range([0, width]);
    topBarY = d3.scaleBand().domain(displayData.map(d => d.name)).range([0, height]).padding(0.2);

    topBarSvg.select('.x-axis').transition().duration(500).call(d3.axisBottom(topBarX));
    topBarSvg.select('.y-axis').transition().duration(500).call(d3.axisLeft(topBarY));

    const bars = topBarSvg.selectAll('.top-bar')
        .data(displayData, d => d.id);

    bars.exit().transition().duration(300).attr('width', 0).remove();

    const barsEnter = bars.enter().append('rect')
        .attr('class', 'top-bar bar')
        .attr('y', d => topBarY(d.name))
        .attr('height', topBarY.bandwidth())
        .attr('x', 0)
        .attr('width', 0)
        .attr('fill', d => typeColors[d.type1] || '#fff')
        .on('mouseover', showTooltip)
        .on('mouseout', hideTooltip);

    bars.merge(barsEnter)
        .transition().duration(750)
        .attr('y', d => topBarY(d.name))
        .attr('height', topBarY.bandwidth())
        .attr('x', 0)
        .attr('width', d => topBarX(d[state.xVar]));
}
