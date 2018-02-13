import {
    defineWidget,
    log,
    runCallback,
} from 'widget-base-helpers';
import $ from 'jquery';
window.$ = $; // <-- Can we please remove jQuery? Pretty please? ;-)
import '@progress/kendo-ui';
import '@progress/kendo-ui/css/web/kendo.material.min.css';
import './ui/Grid.scss';
import './ui/Kendo.common.min.scss';
import aspect from 'dojo/aspect';
// import './ui/Kendo.default.min.scss';
import Grid from './Grid';


export default defineWidget('GridContext', false, {}, Grid);
