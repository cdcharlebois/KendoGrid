import {
    defineWidget,
    log,
    runCallback,
} from 'widget-base-helpers';
import $ from 'jquery';
window.$ = $; // <-- Can we please remove jQuery? Pretty please? ;-)
import '@progress/kendo-ui';
import './ui/Grid.scss';
import './ui/Kendo.common.min.scss';
import './ui/Kendo.default.min.scss';


export default defineWidget('Grid', false, {

    _obj: null,

    //modeler
    entity: null,
    columns: null,
    pageSize: null,

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
                    const mapFn = 1 < arguments.length ? arguments[ 1 ] : void undefined;
                    let T;
                    if ('undefined' !== typeof mapFn) {
                        // 5. else
                        // 5. a If IsCallable(mapfn) is false, throw a TypeError exception.
                        if (!isCallable(mapFn)) {
                            throw new TypeError('Array.from: when provided, the second argument must be a function');
                        }

                        // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
                        if (2 < arguments.length) {
                            T = arguments[ 2 ];
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
                        kValue = items[ k ];
                        if (mapFn) {
                            A[ k ] = 'undefined' === typeof T ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
                        } else {
                            A[ k ] = kValue;
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

    postCreate() {
        const cover = document.createElement("div");
        cover.style.height = "100vh";
        cover.style.width = "100vw";
        cover.style.position = "absolute";
        cover.style.backgroundColor = "#a9a9a9";
        cover.style.zIndex = "+1";
        cover.style.display = "none";
        cover.style.backgroundImage = "url(/widgets/Kendo/widget/ui/155b4f2….gif);";
        cover.style.backgroundPosition = "center";
        cover.style.backgroundRepeat = "no-repeat";
        document.body.appendChild(cover);
        this.cover = cover;
        log.call(this, 'postCreate', this._WIDGET_VERSION);
        const gridNode = document.createElement("div");
        gridNode.className = "mx-kendo-grid";
        this.domNode.parentElement.appendChild(gridNode);
        const columnSettings = this.prepareColumns();
        this.gatherData()
            .then(objs => {
                const self = this;
                $(gridNode).kendoGrid({
                    toolbar: ["excel"],
                    excel: {
                        fileName: "Kendo UI Grid Export.xlsx",
                        filterable: true,
                    },
                    dataSource: objs,
                    height: 550,
                    groupable: true,
                    filterable: {
                        mode: "menu, row",
                    },
                    sortable: {
                        mode: "multiple",
                    },
                    pageable: {
                        // refresh: true,
                        pageSize: self.pageSize,
                        // buttonCount: 5,
                    },
                    reorderable: true,
                    resizable: true,
                    columnMenu: true,
                    columns: columnSettings,
                    filter: self.loadPages.bind(self),
                    group: self.loadPages.bind(self),
                    sort: self.loadPages.bind(self),
                    page: self.loadPages.bind(self),

                });
                this.loadPages();
            });
    },

    loadPages() {
        this.cover.style.display = "block";
        setTimeout(() => {
            const els = document.querySelectorAll(".mx-formcell");
            Promise.all(Array.from(els).map(cell => {
                return new Promise(resolve => {
                    mx.data.get({
                        guid: cell.dataset.mxid,
                        callback: mxobj => {
                            const ctx = new mendix.lib.MxContext();
                            ctx.setTrackObject(mxobj);
                            mx.ui.openForm(cell.dataset.mxform, {
                                domNode: cell, // something
                                context: ctx,
                                callback: () => {
                                    resolve();
                                },
                            });
                        },
                    });

                });
            })).then(() => {
                this.cover.style.display = "none";
            });
        }, 0);

    },

    prepareColumns() {
        return this.columns.map(column => {
            return {
                template: "page" === column.cellType ? "<div class='mx-formcell #: classname #' data-mxid='#: mxid #' data-mxform='" + column.form + "'></div>" : "<div data-mxid='#: mxid #' class='#: classname #'>#: " + column.caption.split(" ").join("_") + " #</div>",
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

    gatherData() {
        return new Promise((resolve, reject) => {
            const dataset = [];
            mx.data.get({
                xpath: "//" + this.entity,
                callback: objs => {
                    const allPromises = objs.map(mxobj => {
                        return new Promise(resolveInner => {
                            const row = {};
                            // each column becomes a promise
                            const rowPromises = this.getPromisesForRow(row, mxobj);
                            rowPromises.unshift(new Promise(resolveid => {
                                row.mxid = mxobj.getGuid();
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

    getPromisesForRow(row, mxobj) {
        return this.columns.map(column => {
            return new Promise(resolve => {
                // if ("attr" === column.cellType) {
                if (-1 < column.attribute.indexOf("/")) {
                    // get from association
                    const path = column.attribute.split("/");
                    const target = path[ path.length - 2 ];
                    const attr = path[ path.length - 1 ];
                    const links = path.slice(0, path.length - 2);
                    const revLinks = links.reverse().join("/");
                    mx.data.get({
                        xpath: `//${target}[${revLinks} = ${mxobj.getGuid()}]`,
                        callback: obj => {
                            row[ column.caption.split(" ").join("_") ] = obj[ 0 ].get(attr);
                            resolve();
                        },
                    });
                } else {
                    row[ column.caption.split(" ").join("_") ] = mxobj.get(column.attribute);
                    resolve();
                }
                // } else {
                //     // the pages are rendered after the grid is fully loaded so nothing to do here.
                //     resolve();
                // }

            });
        });
    },
});
