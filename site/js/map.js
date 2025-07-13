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
        CreateMap()
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
        [.8, 'rgb(155,0,0)'],
        [1.0, 'rgb(97,0,0)'],
    ]
    return colorscale
}

async function CreateMap()
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
        selected_state_counties = {
            "type": "FeatureCollection",
            "features": county_map.features.filter(c => c.properties.STATE == state_selected)
        }
        state_locations = selected_state_counties.features.map(f => f.properties.NAME)
        selected_state_counties.features.forEach(f => f.id = f.properties.NAME)
        state_idxs = selected_state_counties.features.map(f => 100 * (f.properties.data[year_idx].rvotes - f.properties.data[year_idx].dvotes) / (f.properties.data[year_idx].totalvotes))

        us_map_data[0].marker.line.width = 4

        us_map_data.push({
            type: "choropleth",
            geojson: selected_state_counties,
            locations: state_locations,
            z: state_idxs,
            locationmode: "geojson-id",
            colorscale: CreateColorscale(),
            zmin: -100,
            zmax: 100,
            colorbar: {title: "Vote Margin"},
            hoverinfo: "none",
        })
    }

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
            visible:false,
            bgcolor: 'rgba(0,0,0,0)',
        },
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
        us_map_layout.geo.projection.scale = state_scale
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
                return
            
            state_selected = event.points[0].properties.id
            hover_element.classList.add('hidden')
            CreateMap()
        })

        map_element.on('plotly_buttonclicked', function(data) {
            state_selected = ""
            CreateMap()
        })
    })
    
    
}

async function main()
{
    SetupYearDropdown()
    await GetMaps()
    await CreateMap()
}

main()