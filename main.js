// Global Parameters TODO: Clean all this up

params = {tsagg: "Daily", lagperiod: "", 
          lag: 0, growth: "",
          group: d3.set([]), facet: d3.set([]), startdate: "", enddate: ""};
query = window.location.search.substring(1);
 
metrics = [];
dimfields = [];
datefield = "";

vars = query.split("&");
vars.forEach(function(v) {
    p=v.split("=");
    params[p[0]]=p[1]
})

var parseRawDate = d3.time.format("%m/%d/%Y").parse,
    DatetoStr = d3.time.format("%Y-%m-%d"),
    StrtoDate = d3.time.format("%Y-%m-%d").parse;

var progress = d3.select(".progress");
var progressbar = d3.select(".progressbar");

setToMidnightLocal = function(date){
  var outdate = new Date(date);
  outdate.setHours(0);
  outdate.setMinutes(0);
  outdate.setSeconds(0);
  outdate.setMilliseconds(0);
  return outdate;
} 

Array.prototype.collapse = function(){
  return [].concat.apply([],this);
}

dateadd = {
  Daily: function(date,d){
    var outdate = new Date(date);
    outdate.setDate(date.getDate()+d);
    return outdate;
  },
  Weekly: function(date,d){
    var outdate = new Date(date);
    outdate.setDate(date.getDate()+7*d);
    return outdate;
  },
  Monthly: function(date,d){
    var outdate = new Date(date);
    outdate.setMonth(date.getMonth()+d);
    return outdate;
  },
  Quarterly: function(date,d){
    var outdate = new Date(date);
    outdate.setMonth(date.getMonth()+3*d);
    return outdate;
  },
  Yearly: function(date,d){
    var outdate = new Date(date);
    outdate.setFullYear(date.getFullYear()+d);
    return outdate;
  }
};

dateround = {
  Daily: function(date){return setToMidnightLocal(date);},
  Weekly: function(date, dayofweek){
    dayofweek = dayofweek || 0;
    var outdate = new Date(date);
    var daystoshift = (-(7-dayofweek)-outdate.getDay())%7;
    return setToMidnightLocal(
             dateadd.Daily(outdate, 
                         +daystoshift));},
  Monthly: function(date){
    return new Date(date.getFullYear(),
                    date.getMonth(),1,0,0);},
  Quarterly: function(date){
    return new Date(date.getFullYear(),
                    Math.floor(date.getMonth() / 3)*3,1,0,0);},
  Yearly: function(date){
    return new Date(date.getFullYear(),
                    0,1,0,0);}
};

laglengths = {Daily: 
                {Daily: 1, Weekly: 7, Monthly: 28, Quarterly: 91, Yearly:364},
              Weekly:
                {Weekly: 1, Monthly:4, Quarterly:12, Yearly:52},
              Monthly:
                {Monthly: 1, Quarterly: 3, Yearly: 12},
              Quarterly:
                {Quarterly: 1, Yearly:4},
              Yearly:
                {Yearly: 1}};

rawdata = [];

var barmargin = {top: 10, bottom:20, left:30, right:10},
    bardims = {height: 400, width: 800},
    tsmargin = {top: 35, bottom:20, left:70, right:40},
    tsdims = {height: document.getElementById('main_ts').offsetWidth/1.5, 
              width: document.getElementById('main_ts').offsetWidth};

var groupscale = d3.scale.category10();

readdata = function(rawdata) {
  var fieldnames = Object.keys(rawdata[0]);

  var rowsample = [];

  var dateformats = [d3.time.format("%Y-%m-%d").parse,
                     d3.time.format("%Y/%m/%d").parse,
                     d3.time.format("%y-%m-%d").parse,
                     d3.time.format("%y/%m/%d").parse,
                     d3.time.format("%Y-%d-%m").parse,
                     d3.time.format("%Y/%d/%m").parse,
                     d3.time.format("%y-%d-%m").parse,
                     d3.time.format("%y/%d/%m").parse,
                     d3.time.format("%m-%d-%Y").parse,
                     d3.time.format("%m/%d/%Y").parse,
                     d3.time.format("%m-%d-%y").parse,
                     d3.time.format("%m/%d/%y").parse,
                     d3.time.format("%d-%m-%Y").parse,
                     d3.time.format("%d/%m/%Y").parse,
                     d3.time.format("%d-%m-%y").parse,
                     d3.time.format("%d/%m/%y").parse,
                     Date.parse];

  for(var i=0; i < rawdata.length; i = i + Math.floor(rawdata.length/100)){
    rowsample.push(rawdata[i])
  }

  metrics = [];
  dimfields = [];
  datefield = "";

  for(var i = 0; i< fieldnames.length; i++){
    var fieldsample = rowsample.map(function(d){return d[fieldnames[i]];});

    // Test for Numeric Values
    if (metrics.length == 0 && fieldsample.every(function(d){
          return !isNaN(d);
        })) {

      metrics.push(fieldnames[i]);
      continue;
    } 

    // Test for Date Formats
    testDateFormats = function(){
      for(var j=0; j<dateformats.length; j++){
        if(fieldsample.every(function(d){
          return dateformats[j](d) instanceof Date && DatetoStr(dateformats[j](d)) > "1971-01-01";
        })){
          parseRawDate = dateformats[j];
          datefield = fieldnames[i];
          return true;
        }
      }
      return false;
    }

    // Else add to dimensions
    if(datefield.length > 0 || !testDateFormats()){
      dimfields.push(fieldnames[i]);
    }
  }

  datefield.length == 0 && alert("Date field not found");
  metrics.length == 0 && alert("Metric field not found");

  rawdata.forEach(function(d){
    d[datefield] = parseRawDate(d[datefield]);
    for(var i = 0; i < metrics.length; i++){
      d[metrics[i]] = +d[metrics[i]]
    }
  });

  var seriesData = prepdata(rawdata, params);
  layoutFacets(seriesData, params);
  loadUI(params);
  d3.select(".progress").style("display", "none");
}

// Constructor for UX of inputs and filters applied to dataset
loadUI = function(){
  var dateagg = d3.select("#dateagg .panel-body .nav-stacked")
                     .selectAll("li")
                     .data(Object.keys(laglengths["Daily"]), function(d){return d;});

  dateagg.attr("class", function(d){
               if(d == params.tsagg){
                 return "active";
               } else {
                 return null;
               }});

  dateagg.enter()
            .append("li")
            .attr("class", function(d){
               if(d == params.tsagg){
                 return "active";
               } else {
                 return null;
               }})
            .attr("id", function(d){return d;})
            .on("click",dateaggclick)
            .append("a")
            .attr("data-toggle", "pill")
            .attr("href", "#")
            .html(function(d){return d;})

  dateagg.exit().remove(); 

  dateagg.order();

  function dateaggclick(){
      params.tsagg = this.id;
      loaddata()
  };

  var groupbuttons = d3.select("#grouping")
                       .selectAll(".btn-group-justified")
                       .data(dimfields, function(d){return d;});

  groupbuttons.enter().append("div")
              .attr("class", "btn-group btn-group-justified")
              .attr("role", "group")
              .attr("aria-label", "...")
              .append("div")
              .attr("class", "btn-group")
              .attr("role", "group")
              .attr("data-toggle", "button")
              .append("button")
              .attr("type","button")
              .attr("class", "btn btn-default")
              .html(function(d){return d;})
              .on("click", groupclick);

  groupbuttons.exit().remove();

  function groupclick(){
    if(params.group.has(this.innerText)){
      params.group.remove(this.innerText);
    } else {
      params.group.add(this.innerText);
    }
    d3.select(this)
        .classed("btn-primary",!d3.select(this).classed("active"))
        .classed("btn-default",d3.select(this).classed("active"));
    loaddata();
  };

  var facetbuttons = d3.select("#faceting")
                       .selectAll(".btn-group-justified")
                       .data(dimfields, function(d){return d;});

  facetbuttons.enter().append("div")
              .attr("class", "btn-group btn-group-justified")
              .attr("role", "group")
              .attr("aria-label", "...")
              .append("div")
              .attr("class", "btn-group")
              .attr("role", "group")
              .attr("data-toggle", "button")
              .append("button")
              .attr("type","button")
              .attr("class", "btn btn-default")
              .html(function(d){return d;})
              .on("click", facetclick);

  facetbuttons.exit().remove();
  
  function facetclick(){
    if(params.facet.has(this.innerText)){
      params.facet.remove(this.innerText);
    } else {
      params.facet.add(this.innerText);
    }
    d3.select(this)
        .classed("btn-primary",!d3.select(this).classed("active"))
        .classed("btn-default",d3.select(this).classed("active"));
    loaddata();
  };

  var lagbuttons = d3.select("#lags .panel-body .nav-stacked")
                     .selectAll("li")
                     .data(Object.keys(laglengths[params.tsagg]), function(d){return d;})
                     .attr("class", function(d){
                        if(d == params.lagperiod){
                          return "active";
                        } else {
                          return null;
                      }});

  lagbuttons.enter()
            .append("li")
            .attr("class", function(d){
               if(d == params.lagperiod){
                 return "active";
               } else {
                 return null;
               }})
            .attr("id", function(d){return d;})
            .on("click",lagclick)
            .append("a")
            .attr("data-toggle", "pill")
            .attr("href", "#")
            .html(function(d){return d;})
            .append("span")
            .attr("class","badge")
            .html(params.lag)
            .style("display", "none");

  lagbuttons.exit().remove(); 

  lagbuttons.order();

  d3.select("#lags .panel-body .nav-stacked")
    .append("li")
    .on("click",lagclick)
    .append("a")
    .attr("href", "#")
    .attr("data-toggle", "pill")
    .html("Clear Lags")
    .on("click",lagclick);

   function lagclick(){
     if(this.id == params.lagperiod){
       params.lag++;
     } else {
       params.lagperiod = this.id;
       params.lag = 1;
     }
     
     var badges = d3.selectAll("#lags .badge");
     badges.html(params.lag)
           .style("display", function(d){
       if(d == params.lagperiod){
         return null;
       } else {
         return "none";
       }
     });

     loaddata();
   }

  var growthbuttons = d3.select("#growth .panel-body .nav-stacked")
                     .selectAll("li")
                     .data(Object.keys(laglengths[params.tsagg]), function(d){return d;});

  growthbuttons.enter()
            .append("li")
            .attr("class", function(d){
               if(d == params.growth){
                 return "active";
               } else {
                 return null;
               }})
            .attr("id", function(d){return d;})
            .on("click",growthclick)
            .append("a")
            .attr("data-toggle", "pill")
            .attr("href", "#")
            .html(function(d){return d;})

  growthbuttons.exit().remove(); 

  growthbuttons.order();

  d3.select("#growth .panel-body .nav-stacked")
    .append("li")
    .on("click",growthclick)
    .append("a")
    .attr("href", "#")
    .attr("data-toggle", "pill")
    .html("Reset Growth")
    .on("click",growthclick);

   function growthclick(){
     if(this.id == params.growth){
       return;
     } else {
       params.growth = this.id;
       loaddata();
     }
   }

}


// Prepare data to show in viz based on inputs
prepdata = function(indata, params){

  groupingvars = params.group.values().concat(params.facet.values())

  tsdata = [{data:indata}];
  
  progressbar.style("width","35%");

  tsdata = tsdata.map(function(s){
    var outseries = d3.nest()
    for (var i = 0; i < groupingvars.length; i++){
      var keyfunc = (function(i){
                  return function(d){
                    return d[groupingvars[i]];};})(i);
      outseries = outseries.key(keyfunc)
    }
    outseries = outseries.key(function(d) {
                  
                  return DatetoStr(dateround[params.tsagg](d[datefield]));
                })
                .sortKeys(d3.ascending)
                .rollup(function(v) {
                  return d3.sum(v, function(d){
                    return d[metrics[0]];});})
                .entries(s.data);
    
    progressbar.style("width","40%");

    // unstack nesting
    // for (var i = 0; i < groupingvars.length; i++){
    var mapfunc = function(i){
      return function(t){
        var outdict = {}
        if( i >= (groupingvars.length - 1)){
          var outdicte = {}
          outdicte.data = t.values.map(function(d){
            var outdictd = {}
            outdictd[datefield] = StrtoDate(d.key);
            outdictd[metrics[0]] = d.values;
            return outdictd;
          });
          outdicte[groupingvars[i]] = t.key;
          return outdicte;
        } else {
          return outdict = 
            t.values.map(function(u){
              var outdictd = mapfunc(i+1)(u);
              outdictd[groupingvars[i]] = t.key;
              return outdictd;});
        }
      }};
    if(groupingvars.length == 0) {
      outseries = [{key: "Overall", values: outseries}]
    }
    return outseries.map(mapfunc(0)).collapse();
  })

  tsdata = tsdata.collapse()

  progressbar.style("width","50%");
    
  if(laglengths[params.tsagg].hasOwnProperty(params.growth)) {
    var outseries;
    
    tsdata.forEach(function(s){
      var datearr = s.data.map(function(e){return DatetoStr(e[datefield]);});
      outseries = s.data.map(function(d,i,arr){
        j = datearr.slice(0,d3.max([i,1]))
               .indexOf(DatetoStr(dateadd[params.tsagg](d[datefield],-laglengths[params.tsagg][params.growth])));
        if(j > -1) {
          var outdict = {};
          outdict[datefield] = d[datefield];
          outdict[metrics[0]] = d[metrics[0]] / arr[j][metrics[0]];
          return outdict;
        } else {
          return;
        }
      })

      s.data = outseries.filter(function(d){
        return typeof d != "undefined";
      });
    });
  }

  if(params.lag > 0 & laglengths[params.tsagg].hasOwnProperty(params.lagperiod)) {
    var lagseries = []
    tsdata.forEach(function(s){
      s.shift = 0;
      lagseries.push(s);
      for(var i = 1; i <= params.lag; i++){
        var lagser = jQuery.extend(true, {}, s);
        lagser.data.forEach(function(d){
          d[datefield] = dateadd[params.tsagg](d[datefield], 
             +i*laglengths[params.tsagg][params.lagperiod]);
        });

        var maxdate = d3.max(s.data, function(d) {return d[datefield];})
        lagser.data = lagser.data.filter(function(d){return d[datefield] <= maxdate;});
        lagser.shift = i;
        lagseries.push(lagser)      
      }
  
    });
    tsdata = lagseries;
  }

  progressbar.style("width","70%");
    
  if(params.startdate != ""){
    var startdate = StrtoDate(params.startdate),
        enddate   = StrtoDate(params.enddate);

    tsdata.forEach(function(s){
      s.data = s.data.filter(function(d){
        return d[datefield] > startdate && d[datefield] < enddate;
      })
    })
  }
  

  return tsdata;
}

// Define scales & axes
var x = d3.time.scale(),
	y = d3.scale.linear(),
	opacity = d3.scale.linear(),
	xAxis = d3.svg.axis().scale(x).orient("bottom").ticks(4),
	yAxis = d3.svg.axis().scale(y).orient("left").ticks(5);

// Iterate through and layout each chart 
layoutFacets = function(seriesData, params){
  d3.select(".progress").style("display", null);
  progressbar.style("width","80%");

  d3.select('#main_ts').selectAll('svg').remove();

  var facetdata = [];
  if(params.facet.size() > 0){
    facetdata = d3.nest();
    facetdata = facetdata.key(function(s){
                                return params.facet.values()
                                             .map(function(g){return s[g];})
                                             .join(':');})
                         .entries(seriesData);
  } else {
    facetdata = [{key:"Overall", values: seriesData}];
  }

//   if (params.group.size() > 0){
//     facetdata.forEach(function(s){
//       s.values.forEach(function(t){
//         t.groupname = params.group.values()
//                             .map(function(g){return t[g];})
//                             .join(':');})
//     })
//   } else {
//     facetdata.forEach(function(s){
//       s.values.forEach(
//         function(t){t.groupname="Overall";})});
//   }

  var min_x, max_x, min_y, max_y;

  groupscale.domain(facetdata.map(function(s)
    {return s.values.map(function(t)
      {if (params.group.size() > 0){
         t.groupname = params.group.values()
                             .map(function(g){return t[g];})
                             .join(':');
       } else {
         t.groupname="Overall";
       };
       min_x = d3.min([min_x, d3.min(t.data,function(d){return d[datefield];})]);
       max_x = d3.max([max_x, d3.max(t.data,function(d){return d[datefield];})]);
       min_y = d3.min([min_y, d3.min(t.data,function(d){return d[metrics[0]];})]);
       max_y = d3.max([max_y, d3.max(t.data,function(d){return d[metrics[0]];})]);
       return t.groupname;})}));

  tsdims.width = d3.max([document.getElementById('main_ts').offsetWidth / facetdata.length,
                         400]);
  tsdims.height = tsdims.width*2/3;

  // Recompute scales and axes based on new input parameters
  x = d3.time.scale()
          .domain([min_x,max_x])
          .nice()
          .range([tsmargin.left, tsdims.width-tsmargin.right]);

  y = d3.scale.linear()
            .domain([min_y,max_y])
            .nice()
            .range([tsdims.height - tsmargin.bottom, tsmargin.top]);

  opacity = d3.scale.linear()
                  .domain([0,params.lag])
                  .range([1,0.4]);

  xAxis = d3.svg.axis().scale(x)
            .orient("bottom").ticks(tsdims.width/100);

  yAxis = d3.svg.axis().scale(y)
            .orient("left").ticks(tsdims.height/50);

  var tssvgs = d3.select('#main_ts')
                .selectAll('svg')
				.data(facetdata, function(d){return d.key;});

  tssvgs.each(renderTS);

  tssvgenter = tssvgs.enter().append('svg')
        .attr('width',tsdims.width)
        .attr('height',tsdims.height);

  tssvgenter.html('<defs>'+
               '<marker id="mCircle" markerWidth="10" markerHeight="10"' +
                  'refX="3" refY="3">' +
                  '<circle cx="3" cy="3" r="2" style="stroke: black;"/>' +
               '</marker>' +
             '</defs>');
  
  var focus = tssvgenter.append("g")
                .attr("class", "focus")
                .style("display", "none");

  var overlay = tssvgenter.append("rect")
                .attr("transform", "translate("+tsmargin.left+","+tsmargin.top+")")
                .attr("class", "overlay")
                .attr("width", tsdims.width-tsmargin.left-tsmargin.right)
                .attr("height", tsdims.height-tsmargin.top);



  progressbar.style("width","90%");
    
  tssvgenter.each(renderTS);
  tssvgenter.each(function(d){
    var seriesDataD = d.values;
    var seriestsall = seriesDataD.map(function(s){return s.data;})
                                  .collapse();
    var dateset = d3.set(seriestsall.map(function(d){return DatetoStr(d[datefield]);}))

    var datesall = dateset.values()
                      .map(function(d){return StrtoDate(d);})
                      .sort(d3.ascending)
    this.datesall = datesall;
  });

  focus.append("rect")
       .attr("class","hoverbox")
       .attr("height", tsdims.height-tsmargin.bottom-tsmargin.top+10)
       .attr("y", tsmargin.top-5)
       .attr("width", 2);
  
  focus.append("text")
       .attr("id","startdatetext")
       .attr("x", -(tsmargin.top))
       .style("text-anchor","end")
       .attr("dy", "-.3em")
       .attr("transform", "rotate(-90)")
       .text("my label");

  var overlays = d3.selectAll(".overlay,.tsseries")
                   .on("mouseover", function() { focus.style("display", null); })
                   .on("mouseout", function() { focus.style("display", "none"); })
                   .on("mousemove", startselect)
                   .on("click", spanrange);

  var legtext = tssvgenter.append("text")
                          .attr("class","legend")
                          .attr("transform","translate("+(tsmargin.left+3)+","+(tsmargin.top+10)+")")
                          .attr("x",7);

  function startselect() {
    var tssvg = this.parentElement,
        x0 = x.invert(d3.mouse(tssvg)[0]),
        i = d3.bisect(tssvg.datesall, x0, 1),
        d0 = tssvg.datesall[i-1],
        d1 = tssvg.datesall[i],
        d = (x0 - d0) > d1 -x0 ? d1 : d0;
    
    focus.attr("transform", "translate("+ (x(d)-1) + ",0)")
         .attr("xtranslate", x(d))
         .attr("startdate", DatetoStr(d));
    focus.select("text#startdatetext")
         .text(d3.time.format('%b %d %Y')(d));
    
    if(this.classList.contains("tsseries")){
      var yvalue;
      pathval = this.__data__.data.some(function(e){
          if(DatetoStr(e[datefield]) == DatetoStr(d)){
            yvalue = e[metrics[0]];
            return true;
          } else { return false };
      });
      legtext.text(this.__data__.groupname + ": "+yvalue)
             .attr("stroke", groupscale(this.__data__.groupname))
             .attr("fill", groupscale(this.__data__.groupname));
    }
  }

  function spanrange() {
    overlays.on("mouseout", function() {return;})
           .on("mousemove", hoverrange)
           .on("click", selectrange)
           .on("mouseout", function() {
             focus.select("rect")
                  .attr("width",2)
                  .attr("x",0);});

    focus.append("text")
         .attr("id","enddatetext")
         .attr("x", -(tsmargin.top))
         .style("text-anchor","end")
         .attr("dy", "-.3em")
         .attr("transform", "rotate(-90)")
         .text("my label");
  }
  
  function hoverrange() {
    var tssvg = this.parentElement,
        x0 = x.invert(d3.mouse(tssvg)[0]),
        i = d3.bisect(tssvg.datesall, x0, 1),
        d0 = tssvg.datesall[i-1],
        d1 = tssvg.datesall[i],
        d = (x0 - d0) > d1 -x0 ? d1 : d0;
    
    focus.select("rect")
         .attr("x", -d3.max([0, focus.attr("xtranslate")-x(d)]))
         .attr("width", Math.abs(x(d) - focus.attr("xtranslate")));
    
    focus.select("text#enddatetext")
         .text(d3.time.format('%b %d %Y')(d))
         .attr("y", x(d)-focus.attr("xtranslate"));
    

  }

  function selectrange() {
    var tssvg = this.parentElement,
        x0 = x.invert(d3.mouse(tssvg)[0]),
        i = d3.bisect(tssvg.datesall, x0, 1),
        d0 = tssvg.datesall[i-1],
        d1 = tssvg.datesall[i],
        d = (x0 - d0) > d1 -x0 ? d1 : d0;

    focus.attr("enddate", DatetoStr(d));
    overlays.on("mouseover", function() {})
           .on("mouseout", function() {})
           .on("mousemove", function() {})
           .on("click", zoomin)
           .on("dblclick", zoomout);
  }

  function zoomin() {
    var tssvg = this.parentElement,
        x0 = x.invert(d3.mouse(tssvg)[0]),
        i = d3.bisect(tssvg.datesall, x0, 1),
        d0 = tssvg.datesall[i-1],
        d1 = tssvg.datesall[i],
        d = (x0 - d0) > d1 -x0 ? d1 : d0,
        dstr = DatetoStr(d);

    if(dstr > d3.min([focus.attr("startdate"), focus.attr("enddate")]) &&
       dstr < d3.max([focus.attr("startdate"), focus.attr("enddate")])){
            params.startdate = d3.min([focus.attr("startdate"), 
                                 focus.attr("enddate")]);
      params.enddate   = d3.max([focus.attr("startdate"), 
                                 focus.attr("enddate")]);
      
      focus.style("display", "none");

      loaddata();

      return;     
    } else {
      resethoverbox()
    };
  }


  function zoomout() {
    var tssvg = this.parentElement,
        x0 = x.invert(d3.mouse(tssvg)[0]),
        i = d3.bisect(tssvg.datesall, x0, 1),
        d0 = tssvg.datesall[i-1],
        d1 = tssvg.datesall[i],
        d = (x0 - d0) > d1 -x0 ? d1 : d0,
        dstr = DatetoStr(d);

    if(dstr < d3.min([focus.attr("startdate"), focus.attr("enddate")]) ||
       dstr > d3.max([focus.attr("startdate"), focus.attr("enddate")])){
      params.startdate = "";
      params.enddate   = "";
      focus.style("display", "none");

      d3.select('#main_ts').selectAll('svg').remove();
      
      loaddata();
      return;     
    };
  }

  function resethoverbox() {
    focus.select("rect")
         .attr("width",2)
         .attr("x",0);

    focus.select("text#enddatetext").remove();

    overlay.on("mouseover", function() { focus.style("display", null); })
           .on("mouseout", function() { focus.style("display", "none"); })
           .on("mousemove", startselect)
           .on("click", spanrange);
  }

  tssvgs.exit().remove();
  tssvgs.sort(function(a,b){
    return d3.max(b.values.map(
                    function(s){return s.data.map(
                      function(d){return d[metrics[0]];});}).collapse()) -
           d3.max(a.values.map(
                    function(s){return s.data.map(
                      function(d){return d[metrics[0]];});}).collapse()); 
  })
}

renderTS = function(){
  var seriesDataRend = this.__data__.values;

  var valueline = d3.svg.line()
    .x(function(d) { return x(d[datefield]);})
    .y(function(d) { return y(d[metrics[0]]);})

  seriesDataRend = seriesDataRend.map(function(s){
    var outseries = [];
    var k = 0;
    for(var j = 0; j < (s.data.length-1); j++){
      if (DatetoStr(s.data[j+1][datefield]) == 
          DatetoStr(dateadd[params.tsagg](s.data[j][datefield],1))){
        continue;
      } else {
        var newser = jQuery.extend(true, {}, s);
        newser.data = s.data.slice(k,j+1);
        outseries.push(newser);
        k = j+1;
      }
    }
    j++;
    var newser = jQuery.extend(true, {}, s);
    newser.data = s.data.slice(k,j);
    outseries.push(newser);
    return outseries;
  }).collapse();

  var tssvg = d3.select(this),
	  tspath = tssvg.selectAll('path')
    			.data(seriesDataRend);


  tspath.attr("d", function(d) {
    return valueline(d.data);});
  tspath.enter().append('path')
    .attr("d", function(d) {
      if(d.data.length == 1){
        var outdata = d.data.slice(0);
        outdata = outdata.concat(d.data.slice(0));
        outdata[1][metrics[0]] = y.domain()[0];
        return valueline(outdata);
      } else {
        return valueline(d.data);
      }
      })
    .attr("class","line tsseries")
    .attr("stroke-opacity", function(d) {
      return opacity(d.shift) || 1;})
    .style("stroke", function(d) {return groupscale(d.groupname);})
//     .attr("marker-mid", "url(#mCircle)")
//     .attr("marker-start", "url(#mCircle)")
//     .attr("marker-end", "url(#mCircle)");
    
  tspath.exit().remove();

  // Add the Y Axis
  var yaxisg = tssvg.selectAll("g.yaxis")
             .data([{}]);
  yaxisg.call(yAxis);
  yaxisg.enter().append("g")
        .attr("transform", "translate("+tsmargin.left+",0)")
        .attr("class", "yaxis")
        .attr("height", tsdims.height);

  yaxisg.call(yAxis);

  var xaxisg = tssvg.selectAll("g.xaxis")
             .data([{}]);
  xaxisg.call(xAxis);
  xaxisg.enter().append("g")
        .attr("transform", "translate(0,"+
              (tsdims.height-tsmargin.bottom)+")")
        .attr("class", "xaxis")
        .attr("width", tsdims.width);

  xaxisg.call(xAxis);

  // add a title
  tssvg.append("text")
        .attr("x", ((tsdims.width+tsmargin.left) / 2))             
        .attr("y", (tsmargin.top * 3 / 4))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px")
        .text(this.__data__.key);
  
  progressbar.style("width","0%");
  d3.select(".progress").style("display", "none");
}

loaddata = function(){
  progress = d3.select(".progress");
  progressbar = d3.select(".progress-bar");


  progressbar.style("width","0%");
  d3.select(".progress").style("display", null);

  if(this.id == "filedrop"){
    params = {tsagg: "Daily", lagperiod: "", lag: 0, growth: "",
              group: d3.set([]), facet: d3.set([]), 
              startdate: "", enddate: ""};
  }
  
  var file = document.getElementById('filedrop').files[0];
  if(typeof file == "undefined"){
    progressbar.style("width","30%");
    d3.tsv("DailyCategoryDistrict.tsv", readdata);
  } else {
    var reader = new FileReader();
    reader.onload = function(evt){
      progressbar.style("width","30%");
      var theURL = evt.target.result;
      var filename = document.getElementById('filedrop').files[0].name;
      var fileext = filename.slice(filename.length-3,filename.length);
      if(["tsv","tab"].indexOf(fileext)>-1){
        d3.tsv(theURL, readdata);
      } else if (fileext = 'csv') {
        d3.csv(theURL, readdata);
      } else {
        alert("filetype:."+fileext+" not recognized! Please use .csv OR .tsv formats");
      }
    }
    reader.readAsDataURL(file);
  }
};

document.getElementById('filedrop').addEventListener('change', loaddata, false);

loaddata();