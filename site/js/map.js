us_state_json = null
state_selected = ""
county_map = null
current_group = null
us_map_data = null
graph_group_mode = 'single'

const year_dict = {
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
let map_visibility = [true, false, true, false, false]
const state_names = {
    1: "Alabama",
    2: "Alaska",
    4: "Arizona",
    5: "Arkansas",
    6: "California",
    8: "Colorado",
    9: "Connecticut",
    10: "Delaware",
    11: "District of Columbia",
    12: "Florida",
    13: "Georgia",
    15: "Hawaii",
    16: "Idaho",
    17: "Illinois",
    18: "Indiana",
    19: "Iowa",
    20: "Kansas",
    21: "Kentucky",
    22: "Louisiana",
    23: "Maine",
    24: "Maryland",
    25: "Massachusetts",
    26: "Michigan",
    27: "Minnesota",
    28: "Mississippi",
    29: "Missouri",
    30: "Montana",
    31: "Nebraska",
    32: "Nevada",
    33: "New Hampshire",
    34: "New Jersey",
    35: "New Mexico",
    36: "New York",
    37: "North Carolina",
    38: "North Dakota",
    39: "Ohio",
    40: "Oklahoma",
    41: "Oregon",
    42: "Pennsylvania",
    44: "Rhode Island",
    45: "South Carolina",
    46: "South Dakota",
    47: "Tennessee",
    48: "Texas",
    49: "Utah",
    50: "Vermont",
    51: "Virginia",
    53: "Washington",
    54: "West Virginia",
    55: "Wisconsin",
    56: "Wyoming",
};


//const group_default_palettes = ['#001d5c','#4c206b','#811e6f','#af206a','#d6335c','#f15448','#ff7c2e','#ffa600']
const group_default_palettes = ['#004400','#316127','#577e4b','#7d9d71','#a3bd98','#cbdec2','#f3ffed']
// Map indices
const US_MAP_IDX = 0
const STATE_MAP_MARGINS_IDX = 1
const STATE_MAP_OUTLINES_IDX = 2
const STATE_MAP_HIGHLIGHTS_IDX = 3
const STATE_MAP_SHARE_IDX = 4
const STATE_MAP_NET_IDX = 5

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
            map_visibility = [true, false, true, false, false]
        else if (map_mode == 'voteshare')
            map_visibility = [false, true, true, true, false]
        else if (map_mode == 'votemargin')
            map_visibility = [false, true, true, false, true]

        if (state_selected > 0)
            Plotly.restyle(map_element, {visible: map_visibility}, [1,2,3,4,5])
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
    min_y = 100
    max_y = -100
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
        {
            y = ys.map(f => f.vote_perc)
            map_fn = f => (f * 100).toFixed(2).toLocaleString() + '%'
            use_tickvals = true
            chart_title = "State Voteshare"
        }
        else if (plotType == 'state_marginshare')
        {
            y = ys.map(f => f.r_marg)
            map_fn = f => f > 0 ? `R+${(f * 100).toFixed(2)}` : `D+${(f * -100).toFixed(2)}`
            use_tickvals = true
            chart_title = "State Marginshare"
        }
        else if (plotType == 'net_votes')
        {
            y = ys.map(f => f.rvotes - f.dvotes)
            map_fn = f => f.toLocaleString()
            use_tickvals = false
            chart_title = "Net Votes"
        }
        else if (plotType == 'net_margin')
        {
            y = ys.map(f => (f.rvotes - f.dvotes) / f.totalvotes)
            map_fn = f => f > 0 ? `R+${(f * 100).toFixed(1)}` : `D+${(f * -100).toFixed(1)}`
            use_tickvals = true
            chart_title = "Net Margin"
        }
        else if (plotType == 'total_votes')
        {
            y = ys.map(f => f.totalvotes)
            map_fn = f => f.toLocaleString()
            use_tickvals = false
            chart_title = "Total Votes"
        }
        else 
            return

        customdata = y.map(map_fn)

        traces.push({
            x: xs,
            y: y,
            type: 'scatter',
            name: group.name,
            customdata: customdata,
            hovertemplate: '%{customdata}',
            marker: {
                color: group.color.slice(0,7) + 'FF',
            },
        })

        max_y = Math.max(max_y, 0, ...y)
        min_y = Math.min(min_y, 0, ...y)
    }

    // Stretch range so that values aren't partially cut off at extremes, while not breaking scales
    if (min_y > -0.9 || !use_tickvals)
        min_y *= 1.1
    if (max_y < 0.9 || !use_tickvals)
        max_y *= 1.1

    var layout = {
        title: {
            text: chart_title,
            font: {
                size: 40,
            }
        },
        xaxis: {
            tickvals: Object.keys(year_dict)
        },
        yaxis: {
            range: [(min_y - 0.00049).toFixed(3), (max_y + 0.00049).toFixed(3)],
        },
        plot_bgcolor: '#111111',
        paper_bgcolor: '#111111',
        showlegend: true,
    }

    // Prevent scaling error if both range values are '0.000'
    chart_range = Number(layout.yaxis.range[1] - layout.yaxis.range[0])
    if (chart_range < 0.001)
    {
        layout.yaxis.range = ['-0.001', '0.001']
        chart_range = Number(layout.yaxis.range[1] - layout.yaxis.range[0])
    }
    
    // Apply custom y axis values, only at nice points even if not evenly spaced
    if (use_tickvals)
    {
        tickvals = []
        for (let i = 0; i <= 5; i++)
        {
            // Get evenly spaced, but move each point to the nearest round number
            let y = Number(layout.yaxis.range[0]) + chart_range * (i / 5)
            y = y.toFixed(3)
            tickvals.push(y)
        }
        ticktext = tickvals.map(map_fn)

        layout.yaxis.tickvals = tickvals
        layout.yaxis.ticktext = ticktext
    }

    group_graph = document.getElementById('group_graph')
    Plotly.newPlot(group_graph, traces, layout)
}

function CreateMap(should_relocate)
{
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
        
        selected_state_counties = {
            "type": "FeatureCollection",
            "features": county_map.features.filter(c => c.properties.STATE == state_selected)
        }

        // Map of vote margins, traditional map
        state_locations = selected_state_counties.features.map(f => f.id)
        state_votes = selected_state_counties.features.map(f => {try {return 100 * (f.properties.data[year_idx].rvotes - f.properties.data[year_idx].dvotes) / (f.properties.data[year_idx].totalvotes) } catch(error){return 0}})

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
            colorscale: [['0.0', 'rgba(0,0,0,0)'], ['1.0', 'rgba(0,0,0,0)']],
            hoverinfo: 'none',
            showscale: false,
        })

        // Map of currently highlighted counties so their borders are drawn on top
        highlighted_locations = selected_state_counties.features.map(f => f.id)
        try {
            highlighted_locations = highlighted_locations.filter(f => current_group.counties.includes(f))
            highlight_color = current_group.color
        } catch (_) // No current group, so don't have any highlights
        {
            highlighted_locations = []
            highlight_color = '#00000000'
        }
        
        us_map_data.push({
            type: 'choropleth',
            geojson: selected_state_counties,
            locations: highlighted_locations,
            z: highlighted_locations.map(_ => 0),
            colorscale: [['0.0', 'rgba(0,0,0,0)'], ['1.0', 'rgba(0,0,0,0)']],
            hoverinfo: 'skip',
            showscale: false,
            marker: {
                line: {
                    color: highlight_color,
                    width: 4,
                },
            },
        })

        // Maps of vote distribution
        county_lats = selected_state_counties.features.map(f => f.center.lat)
        county_lons = selected_state_counties.features.map(f => f.center.long)
        county_prop = selected_state_counties.features.map(f => {try{return 100 * f.properties.data[year_idx].vote_perc}catch(_){return 0}})
        
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
                sizemode: 'area',
            },
            hoverinfo: 'none',
            showscale: false,
        })

        
        // Map of county votecount margins
        county_margin = selected_state_counties.features.map(f => {try{return 100 * f.properties.data[year_idx].r_marg}catch(_){return 0}})
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
        dragmode: 'pan',
        geo: {
            scope: "usa",
            projection: {type: "albers usa"},
            lakecolor: "white",
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

        us_map_data[4].marker.sizeref = marker_sizeref_scale / (us_map_layout.geo.projection.scale ** 2)
        us_map_data[5].marker.sizeref = us_map_data[5].marker.sizeref

        for (let i = 0; i < 5; i++)
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
            try 
            {
                rPerc = 100 * (data.rvotes / data.totalvotes)
                dPerc = 100 * (data.dvotes / data.totalvotes)
                rMarg = 100 * (data.rvotes - data.dvotes) / data.totalvotes
                WriteHoverTemplate(props.NAME, data.rvotes, rPerc, data.dvotes, dPerc, rMarg, event.event.x, event.event.y)
            } catch (_) // Occurs if county doesn't have data for that year
            {
                WriteHoverTemplate(props.NAME, 0, 50, 0, 50, 0, event.event.x, event.event.y)
            }
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
            if (graph_group_mode == 'single')
                LoadStateAsGroup()
            else
                LoadStateGroups()
            
            SetupGroups()
        })

        map_element.on('plotly_buttonclicked', function(data) {
            state_selected = ""
            current_group = null
            CreateMap(true)
            UpdateGraph()
        })

        // Resize bubbles when zoomed
        map_element.on('plotly_relayout', function(event) {
            if (!("geo.projection.scale" in event))
                return

            scale = event['geo.projection.scale']
            if (state_selected > 0)
                Plotly.restyle(map_element, 'marker.sizeref', [marker_sizeref_scale / (scale**2)], [4,5])
        })
    })
}

function SetupGroups()
{
    UpdateGroupDropdown()
    UpdateGraph()
}

function UpdateGroupDropdown()
{
    group_options = []
    for (let i = 0; i < selected_groups.length; i++)
    {
        group = selected_groups[i]
        option = document.createElement('option')
        option.value = i
        option.innerHTML = group.name
        group_options.push(option)
    }
    graph_group_select.replaceChildren(...group_options)
    graph_group_select.value = current_group_idx
    graph_group_select.dispatchEvent(new Event('change'))

    // Don't allow deletion if only 1 group exists
    button_delete_group.disabled = selected_groups.length <= 1
}

function LoadStateGroups()
{
    selected_groups = JSON.parse(localStorage.getItem(`groups${state_selected}`))
    if (selected_groups === null)
        selected_groups = [{name: 'Group1', counties:[], color: group_default_palettes[0]}]
    current_group_idx = 0
    current_group = selected_groups[current_group_idx]
    group_selector.classList.remove('hidden')

    ValidateGroup()
}

function LoadStateAsGroup()
{
    selected_groups = [{
        name: state_names[Number(state_selected)], 
        counties:county_map.features.filter(f => f.properties.STATE == state_selected).map(f => f.id), 
        color: '#DDDDDD00'
    }]

    current_group_idx = 0
    current_group = selected_groups[current_group_idx]

    group_selector.classList.add('hidden')
}

function StoreStateGroups()
{
    localStorage.setItem(`groups${state_selected}`, JSON.stringify(selected_groups))
}

function ValidateGroup()
{
    // Find counties in the state that are not in a group or in 2 groups
    ids = selected_state_counties.features.map(f => f.id)
    missing_ids = []
    double_ids = []
    for (const id of ids)
    {
        num_found = 0
        for (const group of selected_groups)
        {
            if (group.counties.includes(id))
            {
                num_found++
            }
        }

        if (num_found == 0)
            missing_ids.push(id)
        else if (num_found > 1)
            double_ids.push(id)
    }

    missing_children = missing_ids.map(id => {
        el = document.createElement('li')
        county = selected_state_counties.features.filter(f => f.id == id)[0].properties
        el.innerHTML = county.NAME + ' ' + county.LSAD
        return el
    })

    double_children = double_ids.map(id => {
        el = document.createElement('li')
        county = selected_state_counties.features.filter(f => f.id == id)[0].properties
        el.innerHTML = county.NAME + ' ' + county.LSAD
        return el
    })

    group_missing_counties_list.replaceChildren(...missing_children)
    if (missing_children.length > 0)
        group_missing_counties.classList.remove('hidden')
    else
        group_missing_counties.classList.add('hidden')

    group_double_counties_list.replaceChildren(...double_children)
    if (double_children.length > 0)
        group_double_counties.classList.remove('hidden')
    else
        group_double_counties.classList.add('hidden')
}

function HandleCountyClick(event)
{
    id = event.points[0].location
    
    if (graph_group_mode == 'single')
    {
        if (current_group.counties.length == 1 && current_group.counties[0] == id)
        {
            LoadStateAsGroup()
        } else {
            current_group.counties = [id]
            current_group.color = '#DDDDDDFF'
            datapoint = selected_state_counties.features.filter(f => f.id == id)[0].properties
            current_group.name = datapoint.NAME + " " + datapoint.LSAD
        }
    } else if (graph_group_mode == 'group')
    {
        if (current_group.counties.includes(id))
            current_group.counties = current_group.counties.filter(f => f != id)
        else
            current_group.counties.push(id)

        StoreStateGroups()
    }
    
    ValidateGroup()
    UpdateGraph()
    UpdateHighlights()
}

function UpdateHighlights()
{
    if (current_group == null)
        return

    highlighted_locations = selected_state_counties.features.map(f => f.id)
    highlighted_locations = highlighted_locations.filter(f => current_group.counties.includes(f))

    Plotly.restyle(map_element, {
        locations: [highlighted_locations],
        z: [highlighted_locations.map(_ => 0)],
        'marker.line.color': current_group.color,
    }, [STATE_MAP_HIGHLIGHTS_IDX])
}

function GetCountyColor(county_id)
{
    if (current_group.counties.includes(county_id))
        return current_group.color

    return 'white'
}

function GetCountyWidth(county_id)
{
    if (current_group.counties.includes(county_id))
        return 4

    return 1
}

function UpdateGraph()
{
    if (current_group == null)
    {
        group_viewer.classList.add('hidden')
        return
    }

    group_viewer.classList.remove('hidden')
    graph_type_selector.dispatchEvent(new Event('change'))
}

function SetupGraphDropdowns()
{
    graph_type_selector = document.getElementById('graph_type_select')
    graph_type_selector.addEventListener('change', () => {
        UpdateLineplot(selected_groups, graph_type_selector.value)
    })

    graph_group_select.addEventListener('change', () => {
        current_group_idx = graph_group_select.value
        current_group = selected_groups[current_group_idx]
        input_group_name.value = current_group.name
        input_group_color.value = current_group.color.slice(0,7)
        UpdateHighlights()
    })

    input_group_color.addEventListener('change', () => {
        current_group.color = input_group_color.value
        UpdateHighlights()
        StoreStateGroups()
    })

    var typing_timer;
    const typing_ms = 1000
    input_group_name.addEventListener('keyup', () => {
        clearTimeout(typing_timer)
        typing_timer = setTimeout(() => {
            current_group.name = input_group_name.value
            graph_group_select.children[current_group_idx].innerHTML = input_group_name.value
            if (current_group.counties.length > 0)
                Plotly.restyle(group_graph, 'name', [input_group_name.value], [graph_group_select.value])
            StoreStateGroups()
        }, typing_ms)
    })
    input_group_name.addEventListener('keydown', () => {
        clearTimeout(typing_timer)
    })
}

function SetupGroupControl()
{
    button_add_group.addEventListener('click', () => {
        idx = selected_groups.length
        selected_groups.push({name: `Group${idx + 1}`, counties:[], color: group_default_palettes[idx % group_default_palettes.length]})
        current_group_idx = idx
        UpdateGroupDropdown()
    })
    
    button_delete_group.addEventListener('click', () => {
        if (selected_groups.length <= 1) // Sanity Check
            return;

        selected_groups = selected_groups.filter((_, idx) => idx != current_group_idx)
        current_group_idx = 0
        UpdateGroupDropdown()
        UpdateGraph()
        StoreStateGroups()
    })
}

function SetupEntitySelector()
{
    entity_selector = document.getElementById('entity_selector_select')
    entity_selector.addEventListener('change', () => {
        graph_group_mode = entity_selector.value

        if (graph_group_mode == 'single' && state_selected > 0)
        {
            LoadStateAsGroup()
            SetupGroups()
        }
        else if (graph_group_mode == 'group' && state_selected > 0)
        {
            LoadStateGroups()
            SetupGroups()
        }
    })
}

function MapResize()
{
    Plotly.Plots.resize(map_element)
}

async function main()
{
    group_selector = document.getElementById('group_selector')
    group_viewer = document.getElementById('group_viewer')
    graph_group_select = document.getElementById('graph_group_select')
    input_group_name = document.getElementById('input_group_name')
    button_add_group = document.getElementById('button_add_group')
    button_delete_group = document.getElementById('button_delete_group')
    input_group_color = document.getElementById('input_group_color')
    group_missing_counties_list = document.getElementById('group_missing_counties_list')
    group_missing_counties = document.getElementById('group_missing_counties')
    group_double_counties_list = document.getElementById('group_double_counties_list')
    group_double_counties = document.getElementById('group_double_counties')
    map_element = document.getElementById('map')

    map_observer = new ResizeObserver(MapResize)
    map_observer.observe(map_element)

    SetupYearDropdown()
    await GetMaps()
    CreateMap(true)
    SetupMapModeDropdown()
    SetupGraphDropdowns()
    SetupGroupControl()
    SetupEntitySelector()
}

main()