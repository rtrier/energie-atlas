import * as L from 'leaflet';
import * as Util from './Util';
import * as MapDescription from './conf/MapDescription';
import { MapDispatcher, MapControl, LayerWrapper } from './controls/MapControl'
import { LayerControl, LayerControlOptions } from './controls/LayerControl';

import { CategorieLayer, CategoryMarker, GeojsonLayer } from './controls/CategorieLayer';
import { LegendControl } from './controls/LegendControl';
import { Geocoder } from './util/L.GeocoderMV';
import { Expression, parseExpression } from './MapClassParser';
import { LayerLoader } from './LayerLoader';


function createGeoCoder(objclass: 'parcel' | 'address' | 'address,parcel', limit: number): Geocoder {
    return new Geocoder('esDtb7H5Kh8zl5YXJ3iIP6xPnKEIb5Ch', {
        serviceUrl: 'https://geo.sv.rostock.de/geocodr/query',
        geocodingQueryParams: {
            'class': objclass,
            'out_epsg': '4326',
            'shape': 'geometry',
            'limit': limit
        },
        reverseQueryParams: {
            'class': objclass,
            'in_epsg': '4326',
            'limit': limit,
            'shape': 'centroid',
            'out_epsg': '4326'
        }
    });
}

/**
 * 
 * @param mapDescriptionUrl initialized the map with the map description file (Standard: layerdef.json) see:{@link MapDescription}
 * @returns 
 */
export function initMap(mapDescriptionUrl?: string) {

    const mapApp = new MapApp(mapDescriptionUrl || 'layerdef.json');
    mapApp.init();
}

export class MapApp {

    availableLayers?: string;

    map: L.Map;

    baseLayers: { [id: string]: L.Layer } = {};
    baseLayer: L.Layer;

    overlayLayers: { [id: string]: LayerWrapper } = {};
    selectedLayerIds: string[];
    currentLayers: L.Layer[] = [];
    mapCtrl: MapControl;
    geocoderAdress: Geocoder;
    geocoderParcel: Geocoder;

    layerLoader = new LayerLoader();

    private mapDescription: string;

    /**
     * 
     * @param mapDescription url to the mapdescription-file see:{@link MapDescription}
     * 
     */
    constructor(mapDescription?: string) {
        this.mapDescription = mapDescription;
    }

    init() {
        // window["leafletOptions"] = {preferCanvas: true};
        const map = this.map = new L.Map('map', {
            maxBounds: [[53, 9.8], [55.5, 15]],
            minZoom: 8,
            // minZoom: 9,
            preferCanvas: true,
            renderer: L.canvas(),
            zoomControl: false
        });
        map.setView([53.9, 12.45], 8);

        MapDescription.getConf(this.mapDescription).then((mapDescr) => this.initLayer(mapDescr));

        const urlParams = new URLSearchParams(window.location.search);
        // ?layers=Windenergieanlagen%20Onshore,Biogasanlagen,Freiflächenanlagen,Freiflächenanlagen%20ATKIS,Strassennetz,Freileitungen%20ab%20110kV,Umspannwerke
        const selL = urlParams.get('layers');
        if (selL) {
            this.selectedLayerIds = selL.split(',');
        }

        // const layerCtrlOptions: LayerControlOptions = {
        //     position: 'topleft',
        //     className: 'flex-no-shrink'
        // }

        const baseLayerCtrl = new LayerControl({
            position: 'topleft',
            className: 'flex-no-shrink'
        });
        const categorieLayerCtrl = new LayerControl({ position: 'topleft' });

        this.mapCtrl = new MapControl({
            position: 'topleft',
            baseLayerCtrl: baseLayerCtrl,
            categorieLayerCtrl: categorieLayerCtrl,
            searchFct: (s) => this._search(s)
        });
        map.addControl(this.mapCtrl);

        // map.addControl(new LegendControl({ position: 'topright' }));
        map.addControl(new L.Control.Zoom({ position: 'topright' }));

    }
    private async _search(s: string): Promise<any[]> {
        if (!this.geocoderAdress) {
            this.geocoderAdress = createGeoCoder('address,parcel', 30);
        }
        
        return new Promise<any[]>((resolve, reject) => {
            this.geocoderAdress.geocode(s).then(
                (result: any) => resolve(result)
            ).catch(
                (reason: any) => reject(reason)
            );
        });
        // const promise02 = new Promise<any[]>((resolve, reject) => {
        //     this.geocoderParcel.geocode(s).then(
        //         (result:any) => resolve(result)
        //     ).catch(
        //         (reason:any) => reject(reason)
        //     );
        // });

        // return new Promise<any>((resolve, reject) => {
        //     Promise.all([promise01, promise02]).then( (results:any[][]) =>
        //         resolve( [].concat(...results) )
        //     ).catch(
        //         (reason:any) => reject(reason)
        //     );
        // });
        // console.error('Method "search" not implemented.');
    }
    initLayer(mapDescr: MapDescription.MapDescription): void {
        console.info('mapDescr', mapDescr);
        mapDescr.baseLayers.forEach((layerDescr) => {
            console.info("BaseLayer:", layerDescr.options)
            const layer = L.tileLayer(layerDescr.url, layerDescr.options);
            layerDescr['layer'] = layer;
            this.baseLayers[layerDescr.label] = layer;
        });
        this.mapCtrl.baseLayerCtrl.setBaseLayers(
            mapDescr.baseLayers,
            { labelAttribute: 'label' }
        );


        this.mapCtrl.categorieLayerCtrl.addThemes(mapDescr.themes);

        mapDescr.themes.forEach((theme) => {
            theme.layers.forEach((layer) => {
                this.overlayLayers[layer.layerDescription.label] = layer;
                if (this.selectedLayerIds && this.selectedLayerIds.indexOf(layer.layerDescription.label) >= 0) {
                    layer.isSelected = true;
                    MapDispatcher.onLayerRequest.dispatch(this.mapCtrl, {
                        type: 'request-layer',
                        layer: layer
                    });
                }
            });
        });

    }


}
