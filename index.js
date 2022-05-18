
function renderCompilation(data, element) {

	var margin = {
			top: 20,
			right: 20,
			bottom: 70,
			left: 40
		},
		width = element.offsetWidth - margin.left - margin.right,
		height = 280 - margin.top - margin.bottom;

	function normalize(l) {
		return l.map(function(d) {
			var s = d._source;
			s.date = new Date(s.published);
			return s;
		}).sort((a, b) => b - a);
	}

	var nb = d3.locale({
		'decimal': ',',
		'thousands': ' ',
		'grouping': [3],
		'currency': ['kr.', ''],
		'dateTime': '%a %b %e %X %Y',
		'date': '%d.%.%Y',
		'time': '%H:%M:%S',
		'periods': ['', ''],
		'days': ['Søndag', 'Mandag', 'Tirsdat', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'],
		'shortDays': ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'],
		'months': ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'],
		'shortMonths': ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']
	});

	var tickFormat = nb.timeFormat.multi([
		['%H:%M', function(d) {
			return d.getMinutes();
		}],
		['%H:%M', function(d) {
			return d.getHours();
		}],
		['%a %d', function(d) {
			return d.getDay() && d.getDate() != 1;
		}],
		['%b %d', function(d) {
			return d.getDate() != 1;
		}],
		['%B', function(d) {
			return d.getMonth();
		}],
		['%Y', function() {
			return true;
		}]
	]);

	var dateFormat = d3.time.format('%d%m%Y'),
		weekFormat = d3.time.format('%Y%U'),
		weekDayFormat = d3.time.format('%Y%U-%w'),
		displayDateFormat = nb.timeFormat('%d. %B %Y');



	var svg = d3.select(element)
		.append('svg')
		.attr('class', 'compilation-graph')
		.attr('width', width + margin.left + margin.right)
		.attr('height', height + margin.top + margin.bottom)
		.append('g')
		.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	var media = d3.select(element).append('div').attr('class', 'bulletin-media');

	 d3.select(element)
		.append('form')
		.attr('class', 'toggle-form')
		.selectAll('input')
		.data([{
			text: 'Vis alle',
			selected: false
		}, {
			text: 'Kun rødmeldinger',
			selected: true
		}])
		.enter()
		.append('input')
		.attr('type', 'button')
		.classed('selected', function(m) {
			return m.selected;
		})
		.on('click', function() {
			d3.selectAll('form input').classed('selected', false);
			d3.select(this).classed('selected', true);
			table.classed('emphasized', !table.classed('emphasized'));
		})
		.attr('value', function(m) {
			return m.text;
		});

	var table = d3.select(element).append('table').attr('class', 'bulletin-table emphasized');

	((response) => {
		var messages = normalize(response.hits.hits);

		var messagesByDate = d3.nest()
			.key(function(d) {
				return dateFormat(d.date);
			})
			.entries(messages);

		var messagesByWeek = d3.nest()
			.key(function(d) {
				return weekFormat(d.date) + '-0';
			})
			.entries(messages);

		messagesByDate.forEach(function(d) {
			d.date = dateFormat.parse(d.key);
			d.count = d.values.length;
		});

		messagesByWeek.forEach(function(d) {
			var emphasisCount = 0;
			d.values.forEach(function(m) {
				if (m.emphasis == 'HIGH')
					emphasisCount++;
			});
			d.date = weekDayFormat.parse(d.key);
			d.emphasisCount = emphasisCount;
		});

		messagesByDate.sort(function(a, b) {
			return d3.ascending(a.date, b.date);
		});
		messages.sort(function(a, b) {
			return d3.ascending(a.date, b.date);
		});

		// day scale
		var x = d3.time.scale()
			.domain(d3.extent(messagesByDate, function(d) {
				return d.date;
			}))
			.nice(d3.time.week)
			.range([0, width]);

		// bar width scale
		var xWidth = d3.scale.ordinal()
			.domain(d3.time.days(x.domain()[0], x.domain()[1]))
			.rangeRoundBands([0, width], .1)
			.rangeBand();

		// circle radius scale
		var cRadius = d3.scale.linear()
			.domain([0, d3.max(messagesByWeek, function(d) {
				return d.emphasisCount;
			})])
			.range([1, height / 2]);

		// week scale
		var x2 = d3.time.scale()
			.domain(d3.extent(messagesByWeek, function(d) {
				return d.date;
			}))
			.nice(d3.time.week)
			.range([0, width]);

		// bar height scale
		var y = d3.scale.linear()
			.domain([0, d3.max(messagesByDate, function(d) {
				return d.count;
			})])
			.range([height, 0]);

		// brush; start with the first week of the data set
		var brush = d3.svg.brush()
			.x(x)
			.extent([x.domain()[0], d3.time.week.offset(x.domain()[0], 1)])
			.on('brushend', brushended);

		var xAxis = d3.svg.axis()
			.scale(x)
			.orient('bottom')
			.tickFormat(tickFormat);

		var yAxis = d3.svg.axis()
			.scale(y)
			.orient('left')
			.ticks(5);

		svg.append('g')
			.attr('class', 'x axis')
			.attr('transform', 'translate(0,' + height + ')')
			.call(xAxis)
			.selectAll('text')
			.style('text-anchor', 'end')
			.attr('dx', '-.8em')
			.attr('dy', '-.55em')
			.attr('transform', 'rotate(-90)');

		svg.append('g')
			.attr('class', 'y axis')
			.call(yAxis)
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('y', 6)
			.attr('dy', '.71em')
			.style('text-anchor', 'end')
			.text('Antall meldinger');

		svg.selectAll('bar')
			.data(messagesByDate)
			.enter().append('rect')
			.attr('class', 'bar')
			.style('fill', 'steelblue')
			.attr('x', function(d) {
				return x(d.date);
			})
			.attr('y', function(d) {
				return y(d.count);
			})
			.attr('height', function(d) {
				return height - y(d.count);
			})
			.attr('width', xWidth == 0 ? .4 : xWidth);

		svg.selectAll('emphasized-circle')
			.data(messagesByWeek)
			.enter().append('circle')
			.attr('class', 'emphasized-circle')
			.attr('cx', function(d) {
				return x2(d.date);
			})
			.attr('dx', function(d) {
				return -cRadius(d.emphasisCount) * 2;
			})
			.attr('r', function(d) {
				return cRadius(d.emphasisCount);
			})
			.attr('cy', height / 2);

		svg.selectAll('.x.axis g.tick')
			.filter(function() {
				return /^\d+$/.test(this.textContent);
			})
			.select('text')
			.attr('class', 'year-tick');

		// var thead = table.append('thead'),
		//     tbody = table.append('tbody');

		var monthFormat = nb.timeFormat('%B'),
			dayFormat = nb.timeFormat('%d');

		table.selectAll('tr')
			.data(messages)
			.enter()
			.append('tr')
			.attr('data-week-year', function(d) {
				return weekFormat(d.date);
			})
			.attr('data-month', function(d) {
				return monthFormat(d.date);
			})
			.attr('data-day', function(d) {
				return dayFormat(d.date);
			})
			.attr('class', function(d) {
				return d.emphasis == 'HIGH' ? 'emphasis-high' : '';
			})
			.selectAll('td')
			.data(function(d) {
				return [displayDateFormat(d.date), d.title || d.description];
			})
			.enter().append('td')
			.text(function(d) {
				return d;
			});

		var gBrush = svg.append('g')
			.attr('class', 'brush')
			.call(brush)
			.call(brush.event);

		gBrush.selectAll('rect')
			.attr('height', height);


		filterByExtent(brush.extent());

		function filterByExtent(extent) {
			table.selectAll('tr').style('display', 'none');

			var week = extent[0];
			do {
				table.selectAll('[data-week-year="' + weekFormat(week) + '"]').style('display', '');
				week = d3.time.week.offset(week, 1);
			} while (week <= extent[1]);

			var selectedBulletins = messages.filter(function(d) {
				return d.date >= extent[0] && d.date <= extent[1];
			});

			media.selectAll('*').remove();
			var images = [];
			selectedBulletins.forEach(function(v) {
				v.relations.forEach(function(r) {
					if (r._type == 'ImageReference')
						images.push(r);
				});
			});

			media.selectAll('div')
				.data(images)
				.enter()
				.append('div').append('img').attr('src', function(r) {
					return 'http://www.nrk.no/contentfile/imagecrop/' + r.id + '?cropid=f169w250';
				});
		}

		function brushended() {
			if (!d3.event.sourceEvent) return; // only transition after input
			var extent0 = brush.extent(),
				extent1 = extent0.map(d3.time.week.round);

			// if empty when rounded, use floor & ceil instead
			if (extent1[0] >= extent1[1]) {
				extent1[0] = d3.time.week.floor(extent0[0]);
				extent1[1] = d3.time.week.ceil(extent0[1]);
			}

			d3.select(this).transition()
				.call(brush.extent(extent1))
				.call(brush.event);

			filterByExtent(extent1);
		}

	})(data);
}

let id = 'ukraina',
	promise;

if (window.location.search.length > 1) {
	id = window.location.search.substring(1)
}

if (/\d\.\d+/.test(id)) {
	let query = {
		query: {
			filtered: {
				query: {
					terms: {
						parents: [ id ]
					}
				}
			}
		}
	}

	promise = fetch('http://elastic.nrk.no/models/teaser/_search?size=100000', {
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		method: 'POST',
		body: JSON.stringify(query)
    })

} else {
	promise = window.fetch(`data/${id}.json`)
}

promise.then((response) => response.json())
	.then((json) => {
		renderCompilation(json, document.getElementById('compilation-browser'));
	});
