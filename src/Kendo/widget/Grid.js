import {
    defineWidget,
    log,
    runCallback,
} from 'widget-base-helpers';
import $ from 'jquery';
window.$ = $;
import '@progress/kendo-ui/js/kendo.core.js';
import '@progress/kendo-ui/js/kendo.data.js';
import '@progress/kendo-ui/js/kendo.columnsorter.js';
import '@progress/kendo-ui/js/kendo.grid.js';
import './ui/Grid.scss';

export default defineWidget('Grid', false, {

    _obj: null,

    //modeler
    entity: null,
    columns: null,
    buttons: null,
    microflows: null,
    pageSize: null,
    offsreenRoot: document.createElement("div"),
    _gridState: null,

    constructor() {
        this.log = log.bind(this);
        this.runCallback = runCallback.bind(this);
        /**
         * Array.from polyfill
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#Polyfill
         */
        // Production steps of ECMA-262, Edition 6, 22.1.2.1
        if (!Array.from) {
            Array.from = (function() {
                const toStr = Object.prototype.toString;
                const isCallable = function(fn) {
                    return 'function' === typeof fn || '[object Function]' === toStr.call(fn);
                };
                const toInteger = function(value) {
                    const number = Number(value);
                    if (isNaN(number)) {
                        return 0;
                    }
                    if (0 === number || !isFinite(number)) {
                        return number;
                    }
                    return (0 < number ? 1 : -1) * Math.floor(Math.abs(number));
                };
                const maxSafeInteger = Math.pow(2, 53) - 1;
                const toLength = function(value) {
                    const len = toInteger(value);
                    return Math.min(Math.max(len, 0), maxSafeInteger);
                };

                // The length property of the from method is 1.
                return function from(arrayLike /*, mapFn, thisArg */ ) {
                    // 1. Let C be the this value.
                    const C = this;

                    // 2. Let items be ToObject(arrayLike).
                    const items = Object(arrayLike);

                    // 3. ReturnIfAbrupt(items).
                    if (null == arrayLike) {
                        throw new TypeError('Array.from requires an array-like object - not null or undefined');
                    }

                    // 4. If mapfn is undefined, then let mapping be false.
                    const mapFn = 1 < arguments.length ? arguments[1] : void undefined;
                    let T;
                    if ('undefined' !== typeof mapFn) {
                        // 5. else
                        // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
                        if (!isCallable(mapFn)) {
                            throw new TypeError('Array.from: when provided, the second argument must be a function');
                        }

                        // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
                        if (2 < arguments.length) {
                            T = arguments[2];
                        }
                    }

                    // 10. Let lenValue be Get(items, "length").
                    // 11. Let len be ToLength(lenValue).
                    const len = toLength(items.length);

                    // 13. If IsConstructor(C) is true, then
                    // 13. a. Let A be the result of calling the [[Construct]] internal method
                    // of C with an argument list containing the single item len.
                    // 14. a. Else, Let A be ArrayCreate(len).
                    const A = isCallable(C) ? Object(new C(len)) : new Array(len);

                    // 16. Let k be 0.
                    let k = 0;
                    // 17. Repeat, while k < len… (also steps a - h)
                    let kValue;
                    while (k < len) {
                        kValue = items[k];
                        if (mapFn) {
                            A[k] = 'undefined' === typeof T ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
                        } else {
                            A[k] = kValue;
                        }
                        k += 1;
                    }
                    // 18. Let putStatus be Put(A, "length", len, true).
                    A.length = len;
                    // 20. Return A.
                    return A;
                };
            })();
        }
    },

    /**
     * Lifecycle: PostCreate
     * ---
     * - Initialize the Grid and add the appropriate listeners
     * - Use this to set configuration options
     * - Data is not bound here--that happens in update
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    postCreate() {
        log.call(this, 'postCreate', this._WIDGET_VERSION);
        this._gridNode = this._gridNode || document.createElement("div");
        this._gridNode.className = "mx-kendo-grid";
        this.domNode.appendChild(this._gridNode);
        const columnSettings = this.prepareColumns();
        const toolbarSettings = this.prepareButtons();
        toolbarSettings.push({
            name: "showConfig",
            text: "Show Config",
        });
        // * set the default config for the grid (data will be bound later)
        const self = this;
        $(this._gridNode).kendoGrid({
            toolbar: toolbarSettings,
            groupable: true,
            filterable: {
                mode: "menu",
            },
            sortable: {
                mode: "multiple",
            },
            pageable: {
                pageSize: self.pageSize,
            },
            selectable: true,
            reorderable: true,
            resizable: true,
            columnMenu: true,
            columns: columnSettings,
            filter: self.loadPages.bind(self),
            group: self.loadPages.bind(self),
            sort: self.loadPages.bind(self),
            page: self.loadPages.bind(self),
        });
        this._kendoGrid = $(this._gridNode).data("kendoGrid");
        this.attachButtonListeners();

        if (this.defaultMicroflow) {
            $(this._gridNode).find("table").on("dblclick", function(e) {
                const $clicked = $(e.target).closest("tr");
                const guid = this._kendoGrid.dataItem($clicked).mxid;
                mx.data.action({
                    params: {
                        actionname: this.defaultMicroflow,
                        guids: [guid],
                        applyto: "selection",
                    },
                    callback: () => {},
                });
            }.bind(self));
        }

    },
    /**
     * Lifecycle: Update
     * ---
     * Called when the widget receives context (or after postcreate if no context)
     * - Refresh the grid (bind data and pages) and reset subscriptions
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    update(obj, callback) {
        this.refreshGrid();
        this.resetSubscriptions();
        if (callback) {
            callback();
        }
    },
    /**
     * Private: loadPages
     * ---
     * Render all the Mendix pages for the cells with a page as content
     * - fetch all .formcell nodes inside the grid
     * - asynchronously render all the pages with the appropriate context
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    loadPages() {
        $(this._gridNode).addClass("mx-blurry");
        setTimeout(() => {
            const els = this._gridNode.querySelectorAll(".mx-formcell");
            Promise.all(Array.from(els).map(cell => {
                return new Promise(resolve => {
                    mx.data.get({
                        guid: cell.dataset.mxid,
                        callback: mxobj => {
                            const ctx = new mendix.lib.MxContext();
                            ctx.setTrackObject(mxobj);
                            mx.ui.openForm(cell.dataset.mxform, {
                                domNode: cell,
                                context: ctx,
                                callback: () => {
                                    resolve();
                                },
                            });
                        },
                    });

                });
            })).then(() => {
                $(this._gridNode).removeClass("mx-blurry");
                this.styleRows();
            });
        }, 0);

    },
    /**
     * Private: prepareColumns
     * ---
     * Generate the metadata for the columns of the grid
     * - read the widget column properties and map those into kendo columns
     * - one thing to note: if the cell is a formcell, we add the name of the form and the mendix object's id
     *     to the cell template as data attributes so that loadPages() can use these values
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    prepareColumns() {
        return this.columns.map(column => {
            const columnKey = column.caption.split(" ").join("_");
            return {
                template: "page" === column.cellType ? "<div class='mx-formcell #: classname #' data-mxid='#: mxid #' data-mxform='" + column.form + "'></div>" : "<div data-mxid='#: mxid #' class='#: classname #'>#: " + columnKey + " #</div>",
                field: column.caption.split(" ").join("_"),
                title: column.caption,
                aggregates: ["average", "sum", "max", "min", "count"],
                groupHeaderTemplate: column.headerTemplate,
                filterable: column.filterMulti ? {
                    multi: true,
                } : undefined,
            };
        });
    },
    /**
     * Private: gatherData
     * ---
     * Asyncronously fetch all the objects that are needed for the grid (comments inline below)
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    gatherData() {
        return new Promise((resolve, reject) => {
            const dataset = [];
            const xrefs = {};
            this.columns.forEach(column => {
                if (3 === column.attribute.split("/").length) {
                    const xref = column.attribute.split("/")[0];
                    // one-hop attr --> add to xrefs
                    xrefs[xref] = {};
                }
            });

            // change the constraint based on whether or not there's a context object that we need to
            // point to in the xpath
            let ctxConstraint = "";
            if (-1 < this.constraint.indexOf('[%CurrentObject%]')) {
                ctxConstraint = this._contextObj ?
                    this.constraint.split("'[%CurrentObject%]'").join("'" + this._contextObj.getGuid() + "'") :
                    "";
            } else {
                ctxConstraint = this.constraint;
            }

            mx.data.get({
                xpath: "//" + this.entity + ctxConstraint,
                filter: {
                    references: xrefs,
                },
                callback: objs => {
                    const allPromises = objs.map(mxobj => {
                        return new Promise(resolveInner => {
                            const row = {};
                            // each column becomes a promise
                            const rowPromises = this.getPromisesForRow(row, mxobj);
                            rowPromises.unshift(new Promise(resolveid => {
                                row.mxid = mxobj.getGuid();
                                row.mxobj = JSON.stringify(mxobj);
                                row.classname = mxobj.get("classname");
                                resolveid();
                            }));
                            Promise.all(rowPromises).then(() => {
                                dataset.push(row);
                                resolveInner();
                            });
                        });
                    });
                    Promise.all(allPromises).then(() => {
                        resolve(dataset);
                    });

                },
                error: err => {
                    reject(err);
                },
            });
        });
    },
    /**
     * Private: getPromisesForRow
     * ---
     * Asynchronously set all the properties of the row object for Kendo
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    getPromisesForRow(row, mxobj) {
        return this.columns.map(column => {
            return new Promise(resolve => {
                const columnKey = column.caption.split(" ").join("_");
                if (-1 < column.attribute.indexOf("/")) {
                    // get from association
                    const path = column.attribute.split("/");
                    const attr = path[path.length - 1];
                    if (3 === path.length) {
                        // one-hop --> use local obj
                        const xref = path[0];
                        // CC Feb 13, 2018 fix for empty association
                        const asscObj = mxobj.getChildren(xref)[0];
                        row[columnKey] = asscObj && asscObj.get(attr) ? asscObj.get(attr) : "";
                        resolve();
                    } else {
                        const target = path[path.length - 2];
                        const links = path.slice(0, path.length - 2);
                        const revLinks = links.reverse().join("/");
                        mx.data.get({
                            xpath: `//${target}[${revLinks} = ${mxobj.getGuid()}]`,
                            callback: obj => {
                                row[columnKey] = obj[0].get(attr);
                                resolve();
                            },
                        });
                    }

                } else {
                    const attrType = mxobj.metaData.getAttributeType(column.attribute);
                    row[columnKey] = "Integer" === attrType ? mxobj.get(column.attribute) * 1 : mxobj.get(column.attribute);
                    resolve();
                }
            });
        });
    },

    /**
     * Private: prepareButtons
     * ---
     * Add the buttons from the widget properties to the Kendo action bar
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    prepareButtons() {
        return this.buttons.map(button => {
            return {
                name: button.buttonText,
                text: button.buttonText,
            };
        });
    },

    /**
     * Private: attachButtonListeners
     * ---
     * Attach listeners to the buttons added in `prepareButtons()`
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    attachButtonListeners() {
        const self = this;
        $(this._gridNode).find('.k-grid-showConfig').on('click', function(e) {
            console.log(this._kendoGrid.getOptions());
            mx.ui.info("The grid configuration has been logged to the browser console.", false);
        }.bind(self));
        $(this._gridNode).find(".k-button").on("click", e => {
            const buttonClicked = e.target.innerText;
            const buttonMatched = this.buttons.find(button => {
                return button.buttonText === buttonClicked;
            });
            if (buttonMatched) {
                // get context
                if (0 < self._kendoGrid.select().length) {
                    const selectedGuid = self._kendoGrid.dataItem(self._kendoGrid.select()).mxid;
                    mx.data.action({
                        params: {
                            actionname: buttonMatched.buttonMicroflow,
                            guids: [selectedGuid],
                            applyto: "selection",
                        },
                        callback: () => {},
                    });
                } else {
                    console.log("nothing selected");
                }

            }
        });
    },

    /**
     * Style Rows
     * ---
     * Styles rows that meet xpath criteria
     *
     * @author Conner Charlebois
     * @since Feb 5, 2018
     */
    styleRows() {
        // get the index of the UnitsInStock cell
        const dataItems = this._kendoGrid.dataSource.view();
        if (!(dataItems && 0 < dataItems.length)) {
            // no items
            return;
        }
        if (dataItems[0].items && "undefined" !== dataItems.hasSubgroups) {
            // it's a group
            return;
        }

        dataItems.forEach(item => {
            // do something
            const row = $(this._gridNode).find("[data-uid='" + item.uid + "']");
            row.addClass(item.classname);

        });
    },
    /**
     * Private: refreshGrid
     * ---
     * Preserve the grid state, then gather the new data, then refresh the grid and load new pages.
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    refreshGrid() {
        this._gridState = {
            sort: this._kendoGrid.getOptions().dataSource.sort,
            filter: this._kendoGrid.getOptions().dataSource.filter,
            group: this._kendoGrid.getOptions().dataSource.group,
            page: this._kendoGrid.getOptions().dataSource.page,
            pageSize: this._kendoGrid.getOptions().dataSource.pageSize,
        };
        this.gatherData()
            .then(objs => {
                const dataSource = new kendo.data.DataSource({
                    data: objs,
                });
                dataSource.sort(this._gridState.sort);
                dataSource.filter(this._gridState.filter);
                dataSource.group(this._gridState.group);
                dataSource.pageSize(this._gridState.pageSize);
                this._kendoGrid.setDataSource(dataSource);
                // not sure why the page needs to be set after. Seems like setDataSource() doesn't respect
                // page() function.
                this._kendoGrid.dataSource.page(this._gridState.page);
                this.loadPages();
                this.styleRows();
            });
    },

    /**
     * Private: resetSubscriptions
     * ---
     * Reset the subscriptions for the widget. 
     * - entity subscription so if any object changes, the grid refreshes as well
     * 
     * @author Conner Charlebois
     * @since Date (press ⇧⌘I)
     */
    resetSubscriptions() {
        this.unsubscribeAll();
        this.subscribe({
            entity: this.entity,
            callback: entity => {
                this.refreshGrid();
            },
        });
    },
});