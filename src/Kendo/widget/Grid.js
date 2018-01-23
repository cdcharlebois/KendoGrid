import {
    defineWidget,
    log,
    runCallback,
} from 'widget-base-helpers';
import $ from 'jquery';
window.$ = $; // <-- Can we please remove jQuery? Pretty please? ;-)
import '@progress/kendo-ui';
import './Grid.scss';
import './Kendo.common.min.scss';
import './Kendo.default.min.scss';


export default defineWidget('Grid', false, {

    _obj: null,

    //modeler
    entity: null,
    columns: null,

    constructor() {
        this.log = log.bind(this);
        this.runCallback = runCallback.bind(this);
    },

    postCreate() {
        log.call(this, 'postCreate', this._WIDGET_VERSION);
        const gridNode = document.createElement("div");
        gridNode.id = "grid";
        this.domNode.parentElement.appendChild(gridNode);
        const columnSettings = this.prepareColumns();
        this.gatherData()
            .then(objs => {
                const self = this;
                $(gridNode).kendoGrid({
                    dataSource: objs,
                    height: 550,
                    groupable: true,
                    sortable: true,
                    pageable: {
                        refresh: true,
                        pageSizes: true,
                        buttonCount: 5,
                    },
                    columns: columnSettings,
                    filter: self.loadPages,
                    group: self.loadPages,
                    sort: self.loadPages,
                });
                this.loadPages();
            });
    },

    loadPages() {
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
            }));
        }, 0);

    },

    prepareColumns() {
        return this.columns.map(column => {
            return {
                template: "page" === column.cellType ? "<div class='mx-formcell' data-mxid='#: mxid #' data-mxform='" + column.form + "'></div>" : undefined,
                field: column.caption,
                title: column.caption,
            };
        });
    },

    gatherData() {
        return new Promise((resolve, reject) => {
            const dataset = [];
            mx.data.get({
                xpath: "//MyFirstModule.Contact",
                callback: objs => {
                    const allPromises = objs.map(mxobj => {
                        return new Promise(resolveInner => {
                            const row = {};
                            // each column becomes a promise
                            const rowPromises = this.getPromisesForRow(row, mxobj);
                            rowPromises.unshift(new Promise(resolveid => {
                                row.mxid = mxobj.getGuid();
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
                if ("attr" === column.cellType) {
                    if (-1 < column.attribute.indexOf("/")) {
                        // get from association
                        const path = column.attribute.split("/");
                        mx.data.get({
                            guid: mxobj.getGuid(),
                            path: path[ 0 ],
                            callback: obj => {
                                row[ column.caption ] = obj[ 0 ].get(path[ 2 ]);
                                resolve();
                            },
                        });
                    } else {
                        row[ column.caption ] = mxobj.get(column.attribute);
                        resolve();
                    }
                } else {
                    // render a page.
                    // const node = document.querySelector(`.mx-colcell-${column.caption}-${mxobj.getGuid()}`);
                    // const ctx = new mendix.lib.MxContext();
                    // ctx.setTrackObject(mxobj);
                    // mx.ui.openForm(column.form, {
                    //     domNode: node, // something
                    //     context: ctx,
                    //     callback: () => {
                    //         resolve();
                    //     },
                    // });
                    resolve();
                }

            });
        });
    },
});
