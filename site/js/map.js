us_state_json = null
state_selected = ""
county_map = null

us_map_data = null

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

async function CreateMap()
{
    map_element = document.getElementById('map')
    hover_element = document.getElementById('hover_info')
    hover_table = document.getElementById('tooltip_votes').getElementsByTagName('tbody')[0]

    shown_features = us_state_json.features.filter(f => f.properties.name != state_selected)
    const locations = shown_features.map(f => f.properties.name)
    const results = shown_features.map(f => f.properties.data[1]["R+"])
    us_state_json_copy = JSON.parse(JSON.stringify(us_state_json))
    us_state_json_copy.features = shown_features

    us_map_data = [{
        type: "choropleth",
        geojson: us_state_json_copy,
        locations: locations,
        z: results,
        locationmode: "geojson-id",
        featureidkey: "properties.name",
        colorscale: "RdBu",
        zmin: -20,
        zmax: 20,
        showscale: false,
        hoverinfo: "none",
    }]

    if (state_selected > 0)
    {
        selected_state_counties = {
            "type": "FeatureCollection",
            "features": county_map.features.filter(c => c.properties.STATE == state_selected)
        }
        state_locations = selected_state_counties.features.map(f => f.properties.NAME)
        selected_state_counties.features.forEach(f => f.id = f.properties.NAME)
        state_idxs = selected_state_counties.features.map(f => 100 * (f.properties.data[5].rvotes - f.properties.data[5].dvotes) / (f.properties.data[5].totalvotes))

        us_map_data.push({
            type: "choropleth",
            geojson: selected_state_counties,
            locations: state_locations,
            z: state_idxs,
            locationmode: "geojson-id",
            colorscale: "RdBu",
            zmin: -20,
            zmax: 20,
            colorbar: {title: "County Number"},
        })
    }

    const us_map_layout = {
        title: "Title Test",
        geo: {
            scope: "usa",
            projection: {type: "albers usa"},
            lakecolor: "white",
        },
        height: 600
    }

    Plotly.newPlot(map_element, us_map_data, us_map_layout, {displayModeBar: false})

    map_element.on('plotly_hover', function(event) {
        point = event.points[0]
        point_index = point.pointIndex
        let hover_offset = window.innerWidth / 20.0
        if (point.fullData.name == "trace 0")
        {
            props = us_map_data[0].geojson.features[point_index].properties
            data = props.data[0]
            hover_element.children[0].innerHTML = `${props.name}`
            hover_table.children[0].children[1].innerHTML = data.RVotes.toLocaleString()
            hover_table.children[0].children[2].innerHTML = data["R%"].toFixed(1) + '%'
            hover_table.children[1].children[1].innerHTML = data.DVotes.toLocaleString()
            hover_table.children[1].children[2].innerHTML = data["D%"].toFixed(1) + '%'
            hover_element.children[2].innerHTML = `${data["R+"] > 0 ? ("R+" + data["R+"].toFixed(1)) : ("D+" + -data["R+"].toFixed(1))}`
            if (data["R+"] > 0) {
                hover_element.children[3].innerHTML = (data.RVotes - data.DVotes).toLocaleString()
                hover_element.style.color = getComputedStyle(map_element).getPropertyValue('--red_text')
            } else {
                hover_element.children[3].innerHTML = (data.RVotes - data.DVotes).toLocaleString()
                hover_element.style.color = getComputedStyle(map_element).getPropertyValue('--blue_text')
            }
            

            hover_element.style.left = `${event.event.x + hover_offset}px`
            hover_element.style.top = `${event.event.y - hover_offset}px`
            hover_element.style.display = 'block'
        } else {

        }
        hover_element.classList.remove('hidden')
    }).on('plotly_unhover', function(data) {
            hover_element.classList.add('hidden')
    })

    Plotly.react(map_element, us_map_data, us_map_layout).then(() => {
        map_element.on("plotly_click", (event) => {
            state_selected = event.points[0].properties.id
            CreateMap()
        })
    })
    
}

async function main()
{
    await GetMaps()
    await CreateMap()
    // map = document.getElementById('map')
    // map_data = [{
    //     type: 'choroplethmap',
    //     geojson: 'data/county_map.json'
    // }]
    // Plotly.newPlot(map, map_data)
}

main()