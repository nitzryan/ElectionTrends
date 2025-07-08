us_state_json = null
state_selected = ""
zip = null
county_map = null

async function GetMaps() {
    // const httpResponse = await fetch('')
    // if (!httpResponse.ok) {
    //     throw new Error(`Failed to get file ${httpResponse.statusText}`)
    // }
    
    await fetch('data/US.zip')
        .then(function(response)
        {
            if (response.status == 200)
                return Promise.resolve(response.blob())
            else
                return Promise.reject(new Error(reponse.statusText))
        })
        .then(JSZip.loadAsync)
        .then(async function(z)
        {
            zip = z
            files = zip["files"]
            f = await zip.file("us-states.json").async("string")
            us_state_json = JSON.parse(f)
        }, function error(e)
    {
        console.log("Error")
    })

    await fetch('data/county_data.json')
        .then(function (response) {
            if (response.status == 200)
                return Promise.resolve(response.json())
            else
                return Promise.reject(new Error(response.statusText))
        })
        .then(function (f) {
            console.log(f)
            county_map = f
        })
}

async function CreateMap()
{
    map_element = document.getElementById('map')
    shown_features = us_state_json.features.filter(f => f.properties.name != state_selected)
    const locations = shown_features.map(f => f.properties.name)
    const densities = shown_features.map(f => f.properties.density)
    us_state_json_copy = JSON.parse(JSON.stringify(us_state_json))
    us_state_json_copy.features = shown_features

    let us_map_data = [{
        type: "choropleth",
        geojson: us_state_json_copy,
        locations: locations,
        z: densities,
        locationmode: "geojson-id",
        featureidkey: "properties.name",
        colorscale: "RdBu",
        showscale: false,
        //colorbar: {title: "Population Density"},
    }]

    console.log(state_selected)
    if (state_selected == "Alabama")
    {
        selected_state_counties = {
            "type": "FeatureCollection",
            "features": county_map.features.filter(c => c.properties.STATE == '01')
        }
        state_locations = selected_state_counties.features.map(f => f.properties.NAME)
        selected_state_counties.features.forEach(f => f.id = f.properties.NAME)
        state_idxs = selected_state_counties.features.map((_, index) => index + 1)
        console.log(selected_state_counties)

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

    console.log(us_map_data)

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
    
    //console.log(us_map_data)

    Plotly.react(map_element, us_map_data, us_map_layout).then(() => {
        map_element.on("plotly_click", (event) => {
            state_idx_selected = event.points[0].pointIndex
            state_selected = us_map_data[0].locations[state_idx_selected]
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