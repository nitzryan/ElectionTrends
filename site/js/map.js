us_state_json = null
state_selected = ""
county_map = null

us_map_data = null

let year_dict = {
    2024: 0,
    2020: 1,
    2016: 2,
    2012: 3,
    2008: 4,
    2004: 5,
    2000: 6
}
let year_idx = year_dict[2024]
const marker_sizeref_scale = 0.15
let map_visibility = [true, false, false, false]

function SetupYearDropdown()
{
    year_select = document.getElementById('year_select')
    for (var year of Object.keys(year_dict).sort().reverse())
    {
        option = document.createElement('option')
        option.value = year
        option.innerHTML = year
        year_select.appendChild(option)
    }

    year_select.addEventListener('change', () => {
        year_idx = year_dict[year_select.value]
        CreateMap(false)
    })
}

function SetupMapModeDropdown()
{
    map_select = document.getElementById('map_select')
    map_select.addEventListener('change', () => {
        map_mode = map_select.value
        if (map_mode == 'normal')
            map_visibility = [true, false, false, false]
        else if (map_mode == 'voteshare')
            map_visibility = [false, true, true, false]
        else if (map_mode == 'votemargin')
            map_visibility = [false, true, false, true]

        if (state_selected > 0)
            Plotly.restyle(map_element, {visible: map_visibility}, [1,2,3,4])
    })
}

async function GetMaps() {
    await fetch('data/states_data.json')
        .then(function (response) {
            if (response.status == 200)
                return Promise.resolve(response.json())
            else
                return Promise.reject(new Error(response.statusText))
        })
        .then(function (f) {
            us_state_json = f
        })

    await fetch('data/county_data.json')
        .then(function (response) {
            if (response.status == 200)
                return Promise.resolve(response.json())
            else
                return Promise.reject(new Error(response.statusText))
        })
        .then(function (f) {
            county_map = f
        })
}

function WriteHoverTemplate(name, rvotes, rperc, dvotes, dperc, rmargin, x, y)
{
    let hover_offset = window.innerWidth / 20.0
    hover_element = document.getElementById('hover_info')
    hover_table = document.getElementById('tooltip_votes').getElementsByTagName('tbody')[0]
    
    hover_element.children[0].innerHTML = name
    hover_table.children[0].children[1].innerHTML = rvotes.toLocaleString()
    hover_table.children[0].children[2].innerHTML = rperc.toFixed(1) + '%'
    hover_table.children[1].children[1].innerHTML = dvotes.toLocaleString()
    hover_table.children[1].children[2].innerHTML = dperc.toFixed(1) + '%'
    
    let netVotes = rvotes - dvotes
    if (netVotes > 0) {
        hover_element.children[2].innerHTML = "R+" + rmargin.toFixed(1)
        hover_element.children[3].innerHTML = netVotes.toLocaleString()
        hover_element.style.color = getComputedStyle(map_element).getPropertyValue('--red_text')
    } else {
        hover_element.children[2].innerHTML = "D+" + (-rmargin).toFixed(1)
        hover_element.children[3].innerHTML = (-netVotes).toLocaleString()
        hover_element.style.color = getComputedStyle(map_element).getPropertyValue('--blue_text')
    }

    hover_element.style.left = `${x + hover_offset}px`
    hover_element.style.top = `${y - hover_offset}px`
    hover_element.style.display = 'block'
}

function CreateColorscale()
{
    colorscale = [
        [0.0, 'rgb(0,0,81)'],
        [0.2, 'rgb(0,74,150)'],
        [0.35, 'rgb(33,102,172)'],
        [0.46, 'rgb(103,169,207)'],
        [0.4999, 'rgb(209,229,240)'],
        [0.5, 'rgb(247,247,247)'],
        [0.5001, 'rgb(253,219,199)'],
        [0.54, 'rgb(239,138,98)'],
        [0.65, 'rgb(178,24,43)'],
        [0.8, 'rgb(155,0,0)'],
        [1.0, 'rgb(97,0,0)'],
    ]
    return colorscale
}

function ApplyColorscale(colorscale, value)
{
    for (let i = 1; i < colorscale.length; i++)
    {
        if (value <= colorscale[i][0])
        {
            const colorscale_delta = colorscale[i][0] - colorscale[i-1][0]
            const prop_preceding = (colorscale[i][0] - value) / colorscale_delta
            const prop_current = 1 - prop_preceding

            const [prev_r, prev_g, prev_b] = colorscale[i-1][1].replace('rgb(', '')
                .replace(')', '')
                .split(',')
                .map(str => Number(str));;

            const [cur_r, cur_g, cur_b] = colorscale[i][1].replace('rgb(', '')
                .replace(')', '')
                .split(',')
                .map(str => Number(str));;

            const r = (prev_r * prop_preceding) + (cur_r * prop_current)
            const g = (prev_g * prop_preceding) + (cur_g * prop_current)
            const b = (prev_b * prop_preceding) + (cur_b * prop_current)

            return `rgb(${r},${g},${b})`
        }
    }

    return 'rgb(0,0,0)'
}

function UpdateLineplot(groupList, plotType)
{
    var traces = []
    for(const group of groupList)
    {
        counties = county_map.features.filter(f => group.counties.includes(f.id))
        xs = Object.keys(year_dict).sort().reverse()
        ys = Array.from(xs, () => ({
            totalvotes: 0,
            rvotes: 0,
            dvotes: 0,
            vote_perc: 0,
            r_marg: 0
        }))

        for(const county of counties)
        {
            const data = county.properties.data
            for(let i = 0; i < data.length; i++)
            {
                d = data[i]
                ys[i].totalvotes += d.totalvotes
                ys[i].rvotes += d.rvotes
                ys[i].dvotes += d.dvotes
                ys[i].vote_perc += d.vote_perc
                ys[i].r_marg += d.r_marg
            }
        }

        if (plotType == 'state_voteshare')
            y = ys.map(f => f.vote_perc)
        else if (plotType == 'state_marginshare')
            y = ys.map(f => f.r_marg)
        else if (plotType == 'net_votes')
            y = ys.map(f => f.rvotes - f.dvotes)
        else if (plotType == 'net_margin')
            y = ys.map(f => (f.rvotes - f.dvotes) / f.totalvotes)
        else if (plotType == 'total_votes')
            y = ys.map(f => f.totalvotes)

        traces.push({
            x: xs,
            y: y,
            type: 'scatter'
        })
    }

    group_graph = document.getElementById('group_graph')
    Plotly.newPlot(group_graph, traces)
}

function CreateMap(should_relocate)
{
    map_element = document.getElementById('map')
    
    shown_features = us_state_json.features.filter(f => f.id != state_selected)
    const locations = shown_features.map(f => f.properties.name)
    const results = shown_features.map(f => f.properties.data[year_idx]["R+"])
    us_state_json_copy = JSON.parse(JSON.stringify(us_state_json))
    us_state_json_copy.features = shown_features

    us_map_data = [{
        type: "choropleth",
        geojson: us_state_json_copy,
        locations: locations,
        z: results,
        locationmode: "geojson-id",
        featureidkey: "properties.name",
        colorscale: CreateColorscale(),
        zmin: -100,
        zmax: 100,
        showscale: false,
        hoverinfo: "none",
        marker: {
            line: {
                color: 'white',
                width: 2,
            }
        }
    }]

    if (state_selected > 0)
    {
        // Map of vote counts
        selected_state_counties = {
            "type": "FeatureCollection",
            "features": county_map.features.filter(c => c.properties.STATE == state_selected)
        }

        state_locations = selected_state_counties.features.map(f => f.id)
        state_votes = selected_state_counties.features.map(f => 100 * (f.properties.data[year_idx].rvotes - f.properties.data[year_idx].dvotes) / (f.properties.data[year_idx].totalvotes))

        us_map_data[0].marker.line.width = 4

        us_map_data.push({
            type: "choropleth",
            geojson: selected_state_counties,
            locations: state_locations,
            z: state_votes,
            locationmode: "geojson-id",
            colorscale: CreateColorscale(),
            zmin: -100,
            zmax: 100,
            colorbar: {title: "Vote Margin"},
            hoverinfo: "none",
        })

        // Background for bubble maps
        us_map_data.push({
            type: 'choropleth',
            geojson: selected_state_counties,
            locations: state_locations,
            z: state_votes,
            locationmode: 'geojson-id',
            colorscale: [['0.0', 'rgb(247,247,247)'], ['1.0', 'rgb(247,247,247)']],
            hoverinfo: 'none',
            showscale: false,
        })

        // Maps of vote distribution
        county_lats = selected_state_counties.features.map(f => f.center.lat)
        county_lons = selected_state_counties.features.map(f => f.center.long)
        county_prop = selected_state_counties.features.map(f => 100 * f.properties.data[year_idx].vote_perc)
        
        state_max_values = us_state_json.features.filter(f => f.id == state_selected)[0].votemax
        county_prop = county_prop.map(f =>  f / state_max_values.share)         
        county_colors = state_votes.map(f => ApplyColorscale(colorscale, 0.5 + (0.5 * f / 100)))

        us_map_data.push({
            type: 'scattergeo',
            lat: county_lats,
            lon: county_lons,
            marker: {
                size: county_prop,
                color: county_colors,
                line: {
                    color: Array(county_prop.size).fill('black'),
                    width: Array(county_prop.size).fill(1)
                },
                sizemode: 'area',
            },
            hoverinfo: 'none',
            showscale: false,
        })

        
        // Map of county votecount margins
        county_margin = selected_state_counties.features.map(f => 100 * f.properties.data[year_idx].r_marg)
        county_margin = county_margin.map(f => f / state_max_values.margin)
        county_colors = county_margin.map(f => f > 0 ? 'red' : 'blue')
        county_margin = county_margin.map(f => Math.abs(f))

        us_map_data.push({
            type: 'scattergeo',
            lat: county_lats,
            lon: county_lons,
            marker: {
                size: county_margin,
                color: county_colors,
                line: {
                    color: 'black',
                    width: 1
                },
                sizemode: 'area',
            },
            hoverinfo: 'none',
            showscale: false,
        })
    }

    // Button to exit state mode
    let update_menus = [
        {
            buttons: state_selected > 0 ?
            [
                {
                    args: [],
                    label: "Return",
                    execute: false,
                }
            ] : [],
            type: 'buttons',
        }
    ]

    let us_map_layout = {
        title: "Title Test",
        geo: {
            scope: "usa",
            projection: {type: "albers usa"},
            lakecolor: "white",
            //showcounties: true,
            visible:false,
            bgcolor: 'rgba(0,0,0,0)',
            
        },
        minzoom: 0.5,
        updatemenus: update_menus,
        height: 800,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
    }
    if (state_selected > 0)
    {
        state = us_state_json.features.filter(f => f.id == state_selected)[0].center
        us_map_layout.geo.center = {"lat":state.lat, "lon":state.long}
        
        rect = map_element.getElementsByTagName('rect')[0]
        plot_width = rect.getAttribute('width');
        plot_height = rect.getAttribute('height');

        state_scale = 0.02 * Math.min(plot_height / state.delta_lat, plot_width / state.delta_long)
        
        if (should_relocate)
            us_map_layout.geo.projection.scale = state_scale
        else
            us_map_layout.geo = map_element.layout.geo

        us_map_data[3].marker.sizeref = marker_sizeref_scale / (us_map_layout.geo.projection.scale ** 2)
        us_map_data[4].marker.sizeref = us_map_data[3].marker.sizeref

        for (let i = 0; i < 4; i++)
            us_map_data[i + 1].visible = map_visibility[i]
    }

    Plotly.newPlot(map_element, us_map_data, us_map_layout, {displayModeBar: false})

    map_element.on('plotly_hover', function(event) {
        point = event.points[0]
        point_index = point.pointIndex
        
        if (point.fullData.name == "trace 0")
        {
            props = us_map_data[0].geojson.features[point_index].properties
            data = props.data[year_idx]
            WriteHoverTemplate(props.name, data.RVotes, data["R%"], data.DVotes, data["D%"], data["R+"], event.event.x, event.event.y)
        } else {
            props = us_map_data[1].geojson.features[point_index].properties
            data = props.data[year_idx]
            rPerc = 100 * (data.rvotes / data.totalvotes)
            dPerc = 100 * (data.dvotes / data.totalvotes)
            rMarg = 100 * (data.rvotes - data.dvotes) / data.totalvotes
            WriteHoverTemplate(props.NAME, data.rvotes, rPerc, data.dvotes, dPerc, rMarg, event.event.x, event.event.y)
        }
        hover_element.classList.remove('hidden')
    }).on('plotly_unhover', function(data) {
            hover_element.classList.add('hidden')
    })

    Plotly.react(map_element, us_map_data, us_map_layout).then(() => {
        map_element.on("plotly_click", (event) => {
            point = event.points[0]
            if (point.fullData.name != "trace 0")
                return HandleCountyClick(event)
            
            state_selected = event.points[0].properties.id
            hover_element.classList.add('hidden')
            CreateMap(true)
            LoadStateGroups()
        })

        map_element.on('plotly_buttonclicked', function(data) {
            state_selected = ""
            CreateMap(true)
            LoadStateGroups()
        })

        // Resize bubbles when zoomed
        map_element.on('plotly_relayout', function(event) {
            if (!("geo.projection.scale" in event))
                return

            scale = event['geo.projection.scale']
            if (state_selected > 0)
                Plotly.restyle(map_element, 'marker.sizeref', [marker_sizeref_scale / (scale**2)], [3,4])
        })
    })
}

function LoadStateGroups()
{
    // Load groups from cookies (TODO)
    selected_groups = JSON.parse(localStorage.getItem(`groups${state_selected}`))
    if (selected_groups === null)
        selected_groups = [{name: 'default', counties:[]}]
    current_group_idx = 0

    UpdateGraph()
}

function StoreStateGroups()
{
    localStorage.setItem(`groups${state_selected}`, JSON.stringify(selected_groups))
}

function HandleCountyClick(event)
{
    point_index = event.points[0].pointIndex
    id = us_map_data[1].geojson.features[point_index].id
    
    if (selected_groups[current_group_idx].counties.includes(id))
        selected_groups[current_group_idx].counties = selected_groups[current_group_idx].counties.filter(f => f != id)
    else
        selected_groups[current_group_idx].counties.push(id)

    StoreStateGroups()
    UpdateGraph()
}

function UpdateGraph()
{
    if (typeof selected_state_counties !== 'undefined' && state_selected > 0)
    {
        Plotly.restyle(map_element, 'marker.line.color', [selected_state_counties.features.map(f => (selected_groups[current_group_idx].counties.includes(f.id)) ? 'yellow' : 'black')], [1])
        Plotly.restyle(map_element, 'marker.line.width', [selected_state_counties.features.map(f => (selected_groups[current_group_idx].counties.includes(f.id)) ? 4 : 1)], [1])
    }
    
    if (!selected_groups.reduce((any_found, current_list) => any_found || current_list.counties.length > 0, false))
    {
        group_viewer.classList.add('hidden')
        return
    }

    group_viewer.classList.remove('hidden')
    graph_type_selector.dispatchEvent(new Event('change'))
}

function SetupGraphDropdown()
{
    graph_type_selector = document.getElementById('graph_type_select')
    graph_type_selector.addEventListener('change', () => {
        UpdateLineplot(selected_groups, graph_type_selector.value)
    })
}

async function main()
{
    localStorage.clear()
    group_viewer = document.getElementById('group_viewer')
    
    SetupYearDropdown()
    await GetMaps()
    await CreateMap(true)
    SetupMapModeDropdown()
    SetupGraphDropdown()
}

main()