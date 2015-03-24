var hexLayer = "";

function addLegend() {

	var legend = L.control({position: 'bottomright'});

	legend.onAdd = function (map) {
	    var div = L.DomUtil.create('div', 'info legend'),
	        grades = [0, 5, 10, 25, 50];

	    for ( var i = 0; i < grades.length; i++ ) {
	        div.innerHTML +=
	            '<i style="background:' + getHexColor(grades[i] + 1) + '"></i> ' +
				(i == 0 ? '0' : grades[i])  + (grades[i + 1] ? '&ndash;' + grades[i + 1] + ' mb/s<br>' : '+ mb/s');
	    }
	    return div;
	};
	legend.addTo(map);

}

function getHexColor(val) {
    return val > 50 ? 'blue' :
           val > 25  ? 'green' :
           val > 10  ? 'purple' :
           val > 5  ? 'yellow' :
           val > 0   ? 'red' : 'transparent';
}

function getHexLayer(url, metric) {

	document.getElementById('spinner').style.display = 'block';

	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function () {
		if ( xhr.readyState === 4 ) {
			if ( xhr.status === 200 ) {
				setHexLayer(xhr.responseText, metric);
			} else {
				console.log(xhr.statusText);
			}
		}
	}
	xhr.open('GET', url);
	xhr.send();

}

function setHexLayer(geoJson, metric) {

	var hexgrid = JSON.parse(geoJson);

	hexgrid.features.forEach( function(cell) {

		var value = cell.properties[metric];
		var hexStyle = cell.hexStyle = {};

		hexStyle.weight = 1;
		hexStyle.fillOpacity = 0.3;

		if ( ! value ) {
			hexStyle.weight = 0;
			hexStyle.fillOpacity = 0;
		} else {
			hexStyle.color = getHexColor(value);
			console.log('VAL: ' + value + '; COLOR: ' + hexStyle.color);
		}

	});

	hexLayer = L.geoJson(hexgrid).eachLayer( function(l) {
		l.bindPopup(make_popup(l.feature.properties));
		l.setStyle(l.feature['hexStyle']);
	});

	document.getElementById('spinner').style.display = 'none';

	map.addLayer(hexLayer);

}

function make_popup(props) {

	var popup = 'DL throughput: ' + Math.round(props.download_avg * 10) / 10 + '<br/>';
	popup += 'DL data points: ' + Math.round(props.download_count * 10) / 10 + '<br/>';
	popup += 'UL throughput: ' + Math.round(props.upload_avg * 10) / 10 + '<br/>';
	popup += 'UL data points: ' + Math.round(props.upload_count * 10) / 10 + '<br/>';
	popup += 'Average RTT: ' + Math.round(props.rtt_avg);

	return popup;

}

function updateHexLayer(url, metric) {
	map.removeLayer(hexLayer);
	getHexLayer(url, metric);
}
