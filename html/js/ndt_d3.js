/*jslint bitwise: true, browser: true, nomen: true, vars: true */
/*global Uint8Array, d3 */

'use strict';

function NDTmeter(body_element) {
  this.meter = undefined;
  this.arc = undefined;
  this.state = undefined;
  this.body_element = body_element;
  this.time_switched = undefined;

  this.url_path = '/ndt_protocol';
  this.server_port = 3001;

  this.callbacks = {
    'onstart': this.onstart,
    'onstatechange': this.onstatechange,
    'onprogress': this.onprogress,
    'onfinish': this.onfinish,
    'onerror': this.onerror
  };

  this.NDT_STATUS_LABELS = {
    'preparing_s2c': 'Preparing Download',
    'preparing_c2s': 'Preparing Upload',
    'running_s2c': 'Measuring Download',
    'running_c2s': 'Measuring Upload',
    'finished_s2c': 'Finished Download',
    'finished_c2s': 'Finished Upload',
    'preparing_meta': 'Preparing Metadata',
    'running_meta': 'Sending Metadata',
    'finished_meta': 'Finished Metadata',
    'finished_all': 'Test Complete'
  };

  this.create();
}

NDTmeter.prototype.update_display = function (status, information) {
  d3.select('#ndt-status').text(status);
  d3.select('text.information').text(information);
  return;
};

NDTmeter.prototype.create = function () {

  var ndtDiv = d3.select('#ndt-div');
  var width = ndtDiv.property('offsetWidth') -
    (ndtDiv.style('padding-left').replace(/px/,'') * 2);
  var twoPi = 2 * Math.PI;
  var innerRad = (width * 0.40);
  var outerRad = (width * 0.50);

  var svg = d3.select(this.body_element).append("svg")
    .attr("viewBox", "0 0 " + width + " " + width )
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
      .attr("transform", "translate(" + width / 2 + "," + width / 2 + ")");

  var gradient = svg
    .append("linearGradient")
      .attr("id", "gradient")
      .attr("gradientUnits", "userSpaceOnUse");

  gradient
    .append("stop")
      .attr("offset", "0")
      .attr("stop-color", "#ABE5CC");
  gradient
    .append("stop")
      .attr("offset", "0.5")
      .attr("stop-color", "#90C1AC");

  this.arc = d3.svg.arc()
    .startAngle(0)
    .endAngle(0)
    .innerRadius(innerRad)
    .outerRadius(outerRad);
  this.meter = svg.append("g")
    .attr("id", "progress-meter")
    .attr("fill", "url(#gradient)");
  this.meter.append("path")
    .attr("class", "background")
    .attr("d", this.arc.endAngle(twoPi));
  this.meter.append("path").attr("class", "foreground");
  this.meter.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em")
    .attr("dx", "0.1em")
    .attr("class", "information");

  this.reset_meter();
  this.update_display('', '▶');

  d3.selectAll("#progress-meter text").classed("ready", true);
  d3.selectAll("#progress-meter .foreground").classed("complete", false);
  d3.selectAll("#progress-meter").classed("progress-error", false);

  return;
};

NDTmeter.prototype.onstart = function (server) {
  var that = this;
  var meter_movement = function () {
    that.meter_movement();
  };


  this.reset_meter();
  this.update_display('Connecting', '...');

  d3.timer(meter_movement);
};

NDTmeter.prototype.onstatechange = function (returned_message) {
  this.state = returned_message;
  this.time_switched = new Date().getTime();
  this.update_display(this.NDT_STATUS_LABELS[returned_message], '...');
};

NDTmeter.prototype.onprogress = function (returned_message, passedResults) {
  var throughputRate;
  var progress_label = this.NDT_STATUS_LABELS[this.state];

  if (returned_message === "interval_s2c" && this.state === "running_s2c") {
      throughputRate = passedResults.s2cRate;
  } else if (returned_message === "interval_c2s" &&
          this.state === "running_c2s") {
      throughputRate = passedResults.c2sRate;
  }
};

NDTmeter.prototype.onfinish = function (passed_results) {
  var resultString,
    dy_current,
    metric_name,
    dy_offset = 1.25,
    iteration = 0;

  var results_to_display = {
    's2cRate': 'Download',
    'c2sRate': 'Upload',
    'MinRTT': 'Latency'
  };

  document.getElementById('bigquery_key').value = passed_results['Duration'] +
      passed_results['CountRTT'] + passed_results['PktsIn'] +
      passed_results['PktsOut'];

  for (metric_name in results_to_display) {
    if (results_to_display.hasOwnProperty(metric_name)  &&
        passed_results.hasOwnProperty(metric_name)) {
      if (metric_name == 'MinRTT') {
        resultString = Number(passed_results[metric_name]).toFixed(2);
      } else {
        resultString = Number(passed_results[metric_name] /
          1000).toFixed(2);
      }
      d3.select('#' + metric_name)
        .text(resultString)
        .classed('text-muted', false)
        .classed('metric-value', true);
    }
  }

  d3.selectAll("#progress-meter .foreground").classed("complete", true);
  document.getElementById('ndt').style.display = "none";
  document.getElementById('ndt-results').style.display = "block";
  document.getElementById('extra-data').style.display = "block";
  var child = document.getElementById('ndt');
  document.getElementById('sidebar').removeChild(child);
};

NDTmeter.prototype.onerror = function (error_message) {
  d3.timer.flush();
  d3.selectAll("#progress-meter").classed("progress-error", true);
  this.update_display(error_message, "!");
};

NDTmeter.prototype.reset_meter = function () {
  d3.select('#s2cRate')
    .text('?')
    .classed('metric-value', false)
    .classed('text-muted', true);
  d3.select('#c2sRate')
    .text('?')
    .classed('metric-value', false)
    .classed('text-muted', true);
  d3.select('#progress-meter').classed('progress-complete', false);
  d3.selectAll("#progress-meter text").classed("ready", true);
  return;
};

NDTmeter.prototype.meter_movement = function () {
  var end_angle,
    start_angle,
    progress_label,
    progress_percentage;
  var origin = 0;
  var progress = 0;
  var twoPi = 2 * Math.PI;
  var time_in_progress = new Date().getTime() - this.time_switched;

  if (this.state === "running_s2c" || this.state === "running_c2s") {

    progress_percentage = (time_in_progress < 10000) ?
      (time_in_progress / 10000) : 1;
    progress = twoPi * progress_percentage;
    progress_label = this.NDT_STATUS_LABELS[this.state];
    this.update_display(progress_label,
        ((progress_percentage * 100).toFixed(0) + "%"));

    if (this.state === "running_c2s") {
      progress = twoPi + -1 * progress;
      end_angle = this.arc.endAngle(twoPi);
      start_angle = this.arc.startAngle(progress);
    } else {
      end_angle = this.arc.endAngle(progress);
      start_angle = this.arc.startAngle(origin);
    }
  } else if (this.state === "finished_all") {
    end_angle = this.arc.endAngle(twoPi);
    start_angle = this.arc.startAngle(origin);
  } else {
    end_angle = this.arc.endAngle(origin);
    start_angle = this.arc.startAngle(origin);
  }
  d3.select('.foreground').attr("d", end_angle);
  d3.select('.foreground').attr("d", start_angle);

  if (this.state === 'finished_all') {
    this.update_display(this.NDT_STATUS_LABELS[this.state], '▶');
    return true;
  }

  return false;
};

/* vim: set ts=2 tw=80 sw=2 expandtab : */
