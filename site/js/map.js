us_state_json = null
state_selected = ""
zip = null
county_map = null

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
    shown_features = us_state_json.features.filter(f => f.properties.name != state_selected)
    const locations = shown_features.map(f => f.properties.name)
    const results = shown_features.map(f => f.properties.data[1]["R+"])
    us_state_json_copy = JSON.parse(JSON.stringify(us_state_json))
    us_state_json_copy.features = shown_features

    let us_map_data = [{
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
        //colorbar: {title: "Population Density"},
    }]

    if (state_selected > 0)
    {
        selected_state_counties = {
            "type": "FeatureCollection",
            "features": county_map.features.filter(c => c.properties.STATE == state_selected)
        }
        state_locations = selected_state_counties.features.map(f => f.properties.NAME)
        selected_state_counties.features.forEach(f => f.id = f.properties.NAME)
        state_idxs = selected_state_counties.features.map((_, index) => index + 1)

        us_map_data.push({
            type: "choropleth",
            geojson: selected_state_counties,
            locations: state_locations,
            z: state_idxs,
            locationmode: "geojson-id",
            colorscale: "Viridis",
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

    Plotly.newPlot(map_element, us_map_data, us_map_layout)

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