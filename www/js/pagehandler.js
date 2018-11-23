/* global $ app StripChart PathPlot */

class PageHandler
{
    constructor(config, pageTemplate)
    {
        this.config = config;
        this.netTabHandlers = {};
        this.pageTemplate = pageTemplate;
        this.ntkeyMap = {};
    }

    // buildPage: return html representation of tab contents.  For
    //  deferred html, returned html elements must contain div landing
    //  sites.  
    // Assumptions on this.pageTemplate:
    //     .widgets[] is an array of page contents
    //          .size is the size of a title as [cols,rows]
    //              where entries can be numeric or a string, "fill"
    //          .id is the unique reference to the title useful for async
    //              loading.
    //          .type is the widget type
    //              html - a generic html template rep for a widget
    //              slider -
    //              plot -
    //          .nettab is the optional network table entry or pattern
    //          .params are widget-type-specific parameters
    //              html: url
    //
    buildPage(loadHtmlCB)
    {
        if(this.pageTemplate.widgets)
        {
            let htmllist = [];
            // first build up html (and load it)
            for(let i=0;i<this.pageTemplate.widgets.length;i++)
            {
                let w = this.pageTemplate.widgets[i];
                let sz = w.size;
                let style = `<div id='${w.id}' style='`;
                if(sz[0] == "fill")
                    style += "grid-column:1/-1;";
                else
                    style += `grid-column:span ${sz[0]/10};`; // assume 10px per grid
                if(sz[1] == "fill")
                    style += "grid-row:1/-1;";
                else
                    style += `grid-row:span ${sz[1]/10};`; // assume 10px per grid
                style += "'></div>";
                htmllist.push(style);
            }
            app.debug("pagegrid " + htmllist.join(""));
            loadHtmlCB(htmllist.join(""), function() {
                // we'd like a single callback after all the dust associated
                // with loading widgets settles.   
                this.numWidgetsToLoad = this.pageTemplate.widgets.length;
                for(let i=0;i<this.pageTemplate.widgets.length;i++)
                {
                    let w = this.pageTemplate.widgets[i];
                    if(w.ntkey)
                        this.ntkeyMap[w.ntkey] = w;
                    if(w.type == "html")
                    {
                        let targetElem = $(`#${w.id}`);
                        var fileref = w.params.url;
                        app.sendGetRequest(fileref, function(html) {
                            targetElem.html(html);
                            this._widgetLoaded();
                        }.bind(this));
                    }
                    else
                    {
                        let html;
                        let targetElem = $(`#${w.id}`);
                        switch(w.type)
                        {
                        case "systemstate":
                            html = "<div class='systemstate'>";
                            html += `<label>${w.label}</label>&nbsp;&nbsp;`;
                            html += "STATE <span class='data' id='${w.id}State'>n/a</span>";
                            html += "&nbsp;";
                            html += "STATUS <span class='data' id='${w.id}Status'>n/a</span>";
                            html += "<hr />";
                            html += "</div>";
                            targetElem.html(html);
                            break;
                        case "stripchart":
                            w.params.id = `${w.id}Chart`;
                            html = "<div class='plotContainer'>";
                            html +=   `<label>${w.label}</label>`;
                            html +=   `<div id='${w.params.id}' `;
                            html +=      "style='width:326px;height:162px' ";
                            html +=      "class='stripChart'>";
                            html +=    "</div>";
                            html += "</div>";
                            targetElem.html(html);
                            w.params.id = "#" + w.params.id;
                            w.widget = new StripChart(w.params);
                            break;
                        case "pathplot":
                            w.params.id = `${w.id}Plot`;
                            html = "<div class='plotContainer'>";
                            html +=  `<label>${w.label}</label>`;
                            html +=  `<div id='${w.params.id}'`;
                            html +=      "style='width:326px;height:162px' ";
                            html +=      "class='pathPlot'>";
                            html +=  "</div>";
                            html += "</div>";
                            targetElem.html(html);
                            w.params.id = "#" + w.params.id;
                            w.widget = new PathPlot(w.params);
                            break;
                        case "slider":
                            break; 
                        case "checkbox":
                            break; 
                        case "menubutton":
                            break; 
                        case "gage":
                            break;
                        // more widgets here.
                        default:
                            app.warning("unimplemented widget type " + w.type);
                            break;
                        }
                        if(html)
                        {
                            this._widgetLoaded();
                        }
                    }
                }
            }.bind(this));
        }
    }

    _widgetLoaded()
    {
        this.numWidgetsToLoad--;
        if(this.numWidgetsToLoad == 0)
        {
            // subclasses may wish to install handlers fork widgets after
            // loading.
            this.pageLoaded(); // overridden by subclasses
            app.replayNetTab(); // triggers onNetTabChange
        }
    }

    setNetTabHandler(key, handler)
    {
        if(this.netTabHandlers[key])
            app.warning("nettab collision for " + key);
        this.netTabHandlers[key] = handler;
    }

    pageLoaded()
    {
        // may be overridden by subclasses
        let self = this;

        // Selector (pulldown menu) support ------------------------------
        // assume that the id of the selector matches the SmartDashboard key.
        $(".selector").each(function() {
            var key = $(this).attr("id");
            // var ntkey = "/SmartDashboard/" + key;
            var val = app.getValue(key);
            $(this).val(val);
        });

        // now update network tables on changes
        $(".selector").change(function() {
            var value = $(this).val();
            var key = $(this).attr("id");
            app.putValue(key, value);
        });

        // String support ----------------------------------------------
        $("input[type=text]").on("input", function() {
            var id = $(this).attr("id");
            var ntkey = self.idToSDKey[id];
            if(!ntkey) {
                app.warning("unknown entry " + id);
            }
            var value = $(this).val();
            app.putValue(ntkey, value);
        });

        // Number support ----------------------------------------------
        $("input[type=number]").on("input", function() {
            var id = $(this).attr("id");
            var ntkey = self.idToSDKey[id];
            if(!ntkey) {
                app.warning("unknown number " + id);
            }
            var value = $(this).val();
            app.putValue(ntkey, Number(value));
        });

        // Slider support ----------------------------------------------
        // slider id mapping must be present in idToSDKey map above
        $("input[type=range]").on("input", function() {
            var id = $(this).attr("id");
            var ntkey = self.idToSDKey[id];
            if(!ntkey) {
                app.warning("unknown slider " + id);
            }
            var value = $(this).val();
            $("#"+id+"Txt").text(value);
            // app.logMsg("slider " + id + ": " + Number(value));
            app.putValue(ntkey, Number(value));
        });

        // checkbox support --------------------------------------------
        $("input[type=checkbox]").on("input", function() {
            var id = $(this).attr("id");
            var ntkey = self.idToSDKey[id];
            if(!ntkey) {
                app.warning("unknown checkbox " + id);
            }
            var value = $(this).prop("checked");
            // app.logMsg("checkbox " + id + ": " + value);
            app.putValue(ntkey, value);
        });

        this.updateWhenNoRobot();
    }

    onNetTabChange(key, value, isNew)
    {
        let w = this.ntkeyMap[key];
        if(w == undefined) return;
        w.valueChanged(key, value, isNew);
    }

    updateWhenNoRobot()
    {
        if(!app.robotConnected)
        {
            for(let k in this.ntkeyMap)
            {
                let w = this.ntkeyMap[k].widget;
                if(w && w.addRandomPt)
                    w.addRandomPt();
            }
            setTimeout(this.updateWhenNoRobot.bind(this), 10);
        }
    }
}

window.PageHandler = PageHandler;