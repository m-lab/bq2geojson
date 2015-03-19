var hexLayer = "";

function addLegend() {

	var legend = L.control({position: 'bottomright'});

	legend.onAdd = function (map) {
	    var div = L.DomUtil.create('div', 'info legend'),
	        grades = [5, 10, 25, 50, 100];

	    for ( var i = 0; i < grades.length; i++ ) {
	        div.innerHTML +=
	            '<i style="background:' + getHexColor(grades[i] + 1) + '"></i> ' +
				(i == 0 ? '0' : grades[i-1])  + (grades[i + 1] ? '&ndash;' + grades[i] + ' mb/s<br>' : '+ mb/s');
	    }
	    return div;
	};
	legend.addTo(map);

}

function getHexColor(avg) {
    return avg > 100 ? 'blue' :
           avg > 50  ? 'green' :
           avg > 25  ? 'purple' :
           avg > 10  ? 'yellow' :
           avg > 5   ? 'red' : 'transparent';
}

function setHexLayer(url) {

	document.getElementById('spinner').style.display = 'block';

	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function () {
		if ( xhr.readyState === 4 ) {
			if ( xhr.status === 200 ) {
				addHexLayer(xhr.responseText);
			}
		}
	}
	xhr.open('GET', url);
	xhr.send();

}

function addHexLayer(geoJson) {

	var hexgrid = JSON.parse(geoJson);

	hexgrid.features.forEach( function(cell) {

		var download_avg = cell.properties.download_avg;
		var hexStyle = cell.hexStyle = {};

		hexStyle.weight = 1;
		hexStyle.fillOpacity = 0.3;

		if ( ! download_avg ) {
			hexStyle.weight = 0;
			hexStyle.fillOpacity = 0;
		} else {
			hexStyle.color = getHexColor(download_avg);
		}

	});

	hexLayer = L.geoJson(hexgrid)
		.eachLayer( function(l) {
			l.setStyle(l.feature['hexStyle']);
		});

	document.getElementById('spinner').style.display = 'none';

	map.addLayer(hexLayer);

}

function updateHexLayer(url) {
	map.removeLayer(hexLayer);
	setHexLayer(url);
}
