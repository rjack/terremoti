/* Author: Simone Busoli
*/
(function ($) {
    $(document).ajaxStart(function(){ $('#ajaxIndicator').fadeIn(); })
               .ajaxStop(function(){ $('#ajaxIndicator').fadeOut(); });

    google.load("visualization", "1", { packages: ["corechart", "table"], language: 'it' });
    
    var chartTextStyle = { fontName: '"Trebuchet MS", Verdana, Arial, Helvetica, sans-serif' };

    var map, chart, table, dataTable, chartView, tableView,
        markers = [], tooltips = [], allEvents = [],
        lastReceivedTimestamp = 0, previousNumberOfEvents = 0,
        newEvents = [], defaultTitle = 'T.ER';

    var mapOptions = {
        center: new google.maps.LatLng(44.880, 11.250),
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        panControl: false,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.SMALL
        },
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        },
    };

    var chartOptions = {
        vAxis: { title: 'Magnitude', minValue: 2, textPosition: 'in', textStyle: chartTextStyle, titleTextStyle: chartTextStyle },
        legend: 'none',
        colors: ['#7A2900'],
        tooltip: { showColorCode: false },
        chartArea: { width: '100%', height: '85%' },
        axisTitlesPosition: 'in',
        hAxis: { textPosition: 'in', textStyle: chartTextStyle }
    };

    var tableOptions = {
        showRowNumber: false,
        sortColumn: 0,
        sortAscending: false,
        cssClassNames: { tableCell: 'global-font', headerCell: 'global-font' }
    };

    $(function() {
        map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
        chart = new google.visualization.ScatterChart(document.getElementById('chart_canvas'));
        table = new google.visualization.Table(document.getElementById('table_canvas'));

        loadEvents(drawDataAndStartReceivingUpdates);
    });
    
    function loadEvents(callback) {
        $.get('ParsedExternalData.svc/events/' + lastReceivedTimestamp, function(data) {
            $.each(data, function(i, e) {
                e.localDate = new Date(e.dateUtc);
                lastReceivedTimestamp = e.dateUtc;
            });
            
            if(data && data.length > 0)
                callback(data);
        });
    }

    function drawDataAndStartReceivingUpdates(events) {
        drawVisualizations(events);
        drawMapMarkers(events);
        
        setInterval(updateEvents, 10000);        
    }

    function updateEvents() {
        previousNumberOfEvents = allEvents.length;

        loadEvents(updateData);
    }

    function updateData(events) {
        $.each(events, function(i, e) { newEvents.push(e); });
        updateAlert();
        updateTitle();
        
        addRowsToTable(events);
        chart.draw(chartView, chartOptions);
        table.draw(tableView, tableOptions);

        drawMapMarkers(events);
    }

    function updateTitle() {
        document.title = defaultTitle + (newEvents.length > 0 ? (' (' + newEvents.length + ')') : '');
    }
    
    function updateAlert() {
        if(newEvents.length == 0)
            return;

        $('#alert').remove();

        var message = newEvents.length == 1 ? ('si &eacute; verificato un nuovo evento sismico di magnitudo <em>' + newEvents[0].magnitude + '</em> alle ore ' + newEvents[0].localDate.toLocaleTimeString()) :
                                              'si sono verificati ' + newEvents.length + ' nuovi eventi sismici'; 

        $('<div id="alert" class="alert alert-block fade in">' +
            '<strong>Attenzione:</strong> ' + message +
          '</div>').insertAfter('.page-header')
                   .alert()
                   .css('cursor', 'pointer')
                   .bind('closed', function (){ newEvents = []; updateTitle(); })
                   .click(function(){ $('#alert').alert('close'); });
    }

    function drawVisualizations(events) {
        dataTable = new google.visualization.DataTable();
        dataTable.addColumn('string', '', 'eventId');
        dataTable.addColumn('datetime', 'Date', 'localDate');
        dataTable.addColumn('number', 'Latitude', 'latitude');
        dataTable.addColumn('number', 'Longitude', 'longitude');
        dataTable.addColumn('number', 'Depth', 'depthKm');
        dataTable.addColumn('number', 'Magnitude', 'magnitude');
        dataTable.addColumn('string', 'Scale', 'magnitudeScale');
        dataTable.addColumn('string', 'District', 'district');
        dataTable.addColumn('string', 'Url', 'url');

        addRowsToTable(events);

        drawChart(dataTable);
        drawTable(dataTable);
    }

    function addRowsToTable(events) {
        $.each(events, function(i, e) {
            dataTable.addRow([e.eventId,
                { v: e.localDate },
                e.latitude,
                e.longitude,
                { v: e.depthKm, f: e.depthKm + ' km' },
                { v: e.magnitude, f: (e.magnitude.toString().match(/\./) ? e.magnitude : e.magnitude.toString() + '.0') + ' ' + e.magnitudeScale },
                e.magnitudeScale,
                e.district,
                e.url]);
        });
    }

    function drawChart(dataTable) {
        chartView = new google.visualization.DataView(dataTable);
        chartView.setColumns([1, 5]);

        google.visualization.events.addListener(chart, 'select', chartSelectListener);

        chart.draw(chartView, chartOptions);
    }

    function chartSelectListener() {
        var selection = chart.getSelection();

        $.each(tooltips, function(i, t) { t.close(); });

        if (selection.length == 0) {
            table.setSelection(null);
            return;
        }

        tooltips[selection[0].row].open(map);
        table.setSelection([{ row: selection[0].row }]);
    }

    function drawTable(dataTable) {
        tableView = new google.visualization.DataView(dataTable);
        tableView.setColumns([1, 4, 5]);

        google.visualization.events.addListener(table, 'select', tableSelectListener);

        table.draw(tableView, tableOptions);
    }

    function tableSelectListener() {
        var selection = table.getSelection();

        $.each(tooltips, function(i, t) { t.close(); });


        if (selection.length == 0) {
            chart.setSelection(null);
            return;
        }

        tooltips[selection[0].row].open(map);
        chart.setSelection(selection);
    }

    function drawMapMarkers(events) {
        $.each(events, function(i, e) {
            var coords = new google.maps.LatLng(e.latitude, e.longitude);

            var options = {
                strokeColor: "#7A2900",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#7A2900",
                fillOpacity: 0.35,
                map: map,
                center: coords,
                radius: e.magnitude * 100
            };

            var marker = new google.maps.Circle(options);

            markers.push(marker);

            var tooltip = new google.maps.InfoWindow({
                content: '<h4>Event data  <a class="btn btn-mini" target="_blank" href="' + e.url + '">More &raquo;</a></h4>' +
                    '<dl class="dl-horizontal">' +
                    '<dt>Date</dt>' +
                    '<dd>' + e.localDate + '</dd>' +
                    '<dt>Latitude</dt>' +
                    '<dd>' + e.latitude + '</dd>' +
                    '<dt>Longitude</dt>' +
                    '<dd>' + e.longitude + '</dd>' +
                    '<dt>Depth</dt>' +
                    '<dd>' + e.depthKm + ' km</dd>' +
                    '<dt>Magnitude</dt>' +
                    '<dd>' + e.magnitude + ' ' + e.magnitudeScale + '</dd>' +
                    '</dl>',
                maxWidth: 350,
                position: coords
            });

            tooltips.push(tooltip);

            google.maps.event.addListener(tooltip, 'closeclick', function() {
                table.setSelection(null);
                chart.setSelection(null);
            });

            google.maps.event.addListener(marker, 'click', function() {
                $.each(tooltips, function(_, t) { t.close(); });

                tooltip.open(map);
                chart.setSelection([{ row: i + previousNumberOfEvents }]);
                table.setSelection([{ row: i + previousNumberOfEvents }]);
            });
        });
    }
})(jQuery);