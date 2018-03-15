import { defineWidget } from 'widget-base-helpers';
import Grid from './Grid';

export default defineWidget('GridContext', false, {
    /**
     * @Override Update
     * ---
     * refresh the grid with new context
     * 
     * @author Conner Charlebois
     * @since Mar 15, 2018
     */
    update(obj, callback) {
        if (obj) {
            this._contextObj = obj;
            this.refreshGrid();
        }
        this.resetSubscriptions();
        if (callback) {
            callback();
        }
    },
}, Grid);