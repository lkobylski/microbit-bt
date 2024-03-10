/**
 * MicrobitBT
 *
 * This JavaScript library provides an easy-to-use interface for communicating
 * with a micro:bit microcontroller over Bluetooth Low Energy (BLE) using the Web Bluetooth API.
 * It abstracts the complexity of BLE communication into simple methods for interacting with
 * the micro:bit's features, such as its buttons, LED display, accelerometer, and temperature sensor.
 *
 * Features:
 * - Connect to a micro:bit using BLE.
 * - Read button states.
 * - Control the LED display, including displaying text and scrolling messages.
 * - Access the accelerometer data for motion detection.
 * - Read the onboard temperature sensor.
 * - Send and receive data over the micro:bit's UART service.
 * For more information and examples, visit the GitHub repository: [https://github.com/lkobylski/microbit-bt]
 *
 * Author: Łukasz Kobylski
 * License: MIT
 */

const TEMP_SRV_UUID = 'e95d6100-251d-470a-a062-fa1922dfa9a8'
const TEMP_DATA_UUID = 'e95d9250-251d-470a-a062-fa1922dfa9a8'
const TEMP_PERIOD_UUID = 'e95d1b25-251d-470a-a062-fa1922dfa9a8'

const ACCEL_SRV_UUID = 'e95d0753-251d-470a-a062-fa1922dfa9a8'
const ACCEL_DATA_UUID = 'e95dca4b-251d-470a-a062-fa1922dfa9a8'
const ACCEL_PERIOD_UUID = 'e95dfb24-251d-470a-a062-fa1922dfa9a8'

const LED_SRV_UUID = 'e95dd91d-251d-470a-a062-fa1922dfa9a8'
const LED_STATE_UUID = 'e95d7b77-251d-470a-a062-fa1922dfa9a8'
const LED_TEXT_UUID = 'e95d93ee-251d-470a-a062-fa1922dfa9a8'
const LED_SCROLL_UUID = 'e95d0d2d-251d-470a-a062-fa1922dfa9a8'


const BTN_SRV_UUID = 'e95d9882-251d-470a-a062-fa1922dfa9a8'
const BTN_A_STATE_UUID = 'e95dda90-251d-470a-a062-fa1922dfa9a8'
const BTN_B_STATE_UUID = 'e95dda91-251d-470a-a062-fa1922dfa9a8'

const IO_PIN_SRV_UUID = 'e95d127b-251d-470a-a062-fa1922dfa9a8'
const IO_PIN_DATA_UUID = 'e95d8d00-251d-470a-a062-fa1922dfa9a8'
const IO_AD_CONFIG_UUID = 'e95d5899-251d-470a-a062-fa1922dfa9a8'
const IO_PIN_CONFIG_UUID = 'e95db9fe-251d-470a-a062-fa1922dfa9a8'
const IO_PIN_PWM_UUID = 'e95dd822-251d-470a-a062-fa1922dfa9a8'

const UART_SRV_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";


const EVENT_BUTTON_A_CHANGED = 'buttonA';
const EVENT_BUTTON_B_CHANGED = 'buttonB';
const EVENT_ACCELEROMETER_CHANGED = 'accelerometerChange';
const EVENT_TEMPERATURE_CHANGED = 'temperatureChange';
const UART_DATA_RECEIVED = 'uartDataReceived';
const EVENT_DISCONNECTED = 'disconnected';

class MicrobitBT {
    constructor(debug = true) {
        this.version = '0.0.1';
        this.logger = new Logger(debug);
        this.device = null;
        this.connected = false;
        this.server = null;
        this.defaultTextSpeed = 150;
        
        this.accelerometer = {
            x: 0,
            y: 0,
            z: 0
        };
        
        this.temperature = 0;
        
        this.buttonA = 0;
        this.buttonB = 0;
        
        this.characteristics = {
            LED_STATE: {},
            LED_TEXT: {},
            LED_SCROLL: {},
            UART_TX: {},
            UART_RX: {},
            IO_PIN_DATA: {},
            IO_AD_CONFIG: {},
            IO_PIN_CONFIG: {},
            IO_PIN_PWM: {}
        };
        
        this.supportedEvents = [
            EVENT_BUTTON_A_CHANGED,
            EVENT_BUTTON_B_CHANGED,
            EVENT_ACCELEROMETER_CHANGED,
            EVENT_TEMPERATURE_CHANGED,
            EVENT_DISCONNECTED
        ];
        
        this.eventHandlers = {}
    }
    
    async connect() {
        if (navigator.bluetooth === undefined) {
            throw new Error('Web Bluetooth API is not available');            
        }
        
        try {
            this.device = await navigator.bluetooth.requestDevice({               
                filters: [{namePrefix: 'BBC micro:bit'}],
                optionalServices: [
                    ACCEL_SRV_UUID,                  
                    BTN_SRV_UUID,
                    IO_PIN_SRV_UUID,
                    LED_SRV_UUID,
                    TEMP_SRV_UUID,
                    UART_SRV_UUID
                ]
            });
           
            const server = await this.device.gatt.connect();
            
            this.connected = true;
            
            this.log('Connected to ' + this.device.name);
            
            await this.initializeCharacteristics(server);

            this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
                        
            return true;
            
        }catch (error) {
            this.connected = false;
            throw new Error('Connection error: ' + error);
        }
        
    }
    
    async initializeCharacteristics(server) {
        const services = await server.getPrimaryServices();
        
        try {
            
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                
                for (const characteristic of characteristics) {
                    this.assignCharacteristic(characteristic);  
                    
                    if (characteristic.properties.notify) {
                        await characteristic.startNotifications();
                        this.log('Notifications started for ' + characteristic.uuid);
                        characteristic.addEventListener('characteristicvaluechanged',
                        this.characteristicUpdated.bind(this)
                        );
                    }
                    
                }
            }
        } catch (error) {
            this.error(`Error initializing characteristics: ` + error);
            throw new Error('Error initializing characteristics: ' + error);
        }
        
        this.log(this.characteristics);
    }
    
    onDisconnected(event) {
        this.connected = false;
        this.emit(EVENT_DISCONNECTED, event);
        this.log('Disconnected from ' + this.device.name);
    }

    on(eventName, handler) {
        if (this.supportedEvents.includes(eventName)) {
            if (!this.eventHandlers[eventName]) {
                this.eventHandlers[eventName] = [];
            }    
            this.eventHandlers[eventName].push(handler);  
        } else {
            this.error('Event ' + eventName + ' is not supported');
        }
    }
    
    emit(eventName, ...args) {
        if (this.eventHandlers[eventName]) {
            this.eventHandlers[eventName].forEach(handler => handler(...args));
        }
    }
    
    characteristicUpdated(event) {
        const characteristic = event.target;        
        let value = characteristic.value;
        
        switch (characteristic.uuid) {
            case ACCEL_DATA_UUID:
                this.accelerometer.x = value.getInt16(0, true);
                this.accelerometer.y = value.getInt16(2, true);
                this.accelerometer.z = value.getInt16(4, true);
                this.emit(EVENT_ACCELEROMETER_CHANGED, this.accelerometer);
            break;
            case TEMP_DATA_UUID:                
                this.temperature = value.getInt8(0);
                this.emit(EVENT_TEMPERATURE_CHANGED, this.temperature);
                this.log('Temperature data updated');
            break;
            case BTN_A_STATE_UUID:
            case BTN_B_STATE_UUID:            
                const buttonState = value.getUint8(0);
                if(characteristic.uuid === BTN_A_STATE_UUID) {
                    this.buttonA = buttonState;
                    this.emit(EVENT_BUTTON_A_CHANGED, buttonState);
                    this.log('Button A state updated');
                } else {
                    this.buttonB = buttonState;
                    this.emit(EVENT_BUTTON_B_CHANGED, buttonState);
                    this.log('Button B state updated');
                }
            break;
            
            case UART_RX_UUID:
                console.log("Received data via UART: " + value);
                const receivedData = new TextDecoder().decode(value);
                this.emit(UART_DATA_RECEIVED, receivedData);
                console.log("Received data via UART RX: " + receivedData);
            break;

            case UART_TX_UUID:            
                console.log("Received data via UART TX: " + value);
            break;
            case 'e95db84c-251d-470a-a062-fa1922dfa9a8':
                console.log("unknown: " + value);
            break;

            case 'e95d9775-251d-470a-a062-fa1922dfa9a8':
                console.log("unknown: " + value);
            break;

        }
        
        
    }
    
    isConnected() {
        return this.connected;
    }
    
    getAccelerometerData() {
        return this.accelerometer;
    }
    
    getButtonAState() {
        return this.buttonA;
    }
    
    getButtonBState() {
        return this.buttonB;
    }
    
    getTemperature() {
        return this.temperature;
    }  
    
    async writeTextSpeed(speed) {
        if (!this.connected || !this.characteristics.LED_SCROLL) {            
            this.log('Device is not connected or LED_SCROLL characteristic is not available.');
            return;
        }
        
        try {            
            let speedValue = new Uint8Array([speed]);
            
            await this.characteristics.LED_SCROLL.writeValue(speedValue);
            this.log('Set scrolling speed to: ' + speed);
        } catch (error) {
            this.error('Error setting scrolling speed: ' + error);
        }
    }
    
    
    async writeText(str) {
        if (!this.connected || !this.characteristics.LED_TEXT) {            
            this.error('Device is not connected or LED_TEXT characteristic is not available.');
            return;
        }
        
        try {
            this.writeTextSpeed(this.defaultTextSpeed);
            
            let encoder = new TextEncoder('utf-8');
            let encoded = encoder.encode(str);
                        
            const maxLength = 20;
            for (let i = 0; i < encoded.length; i += maxLength) {
                let chunk = encoded.slice(i, i + maxLength);
                await this.characteristics.LED_TEXT.writeValue(chunk);
                this.log('Sent text to LED matrix: ' + str);
            }
        } catch (error) {
            this.error('Error sending text to LED matrix: ' + error);
        }
    }
    
    async sendToUart(dataString) {
        if (!this.connected || !this.characteristics.UART_RX) {            
            this.error('Device is not connected or UART_RX characteristic is not available.');
            return;
        }
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(dataString);
            await this.characteristics.UART_RX.writeValue(data);
            this.log("Sent data to UART: " + dataString);
        } catch (error) {
            this.error("Error sending data to UART: ", error);
        }
    }
    
    
    assignCharacteristic(characteristic) {
        switch (characteristic.uuid) {
            case IO_PIN_DATA_UUID:
            this.characteristics.IO_PIN_DATA = characteristic;
            break;
            case IO_AD_CONFIG_UUID:
            this.characteristics.IO_AD_CONFIG = characteristic;
            break;
            case IO_PIN_CONFIG_UUID:
            this.characteristics.IO_PIN_CONFIG = characteristic;
            break;
            case IO_PIN_PWM_UUID:
            this.characteristics.IO_PIN_PWM = characteristic;
            break;
            case LED_STATE_UUID:
            this.characteristics.LED_STATE = characteristic;
            break;
            case LED_TEXT_UUID:
            this.characteristics.LED_TEXT = characteristic;
            break;
            case LED_SCROLL_UUID:
            this.characteristics.LED_SCROLL = characteristic;
            break;
            case UART_TX_UUID:
            this.characteristics.UART_TX = characteristic;
            break;
            case UART_RX_UUID:
            this.characteristics.UART_RX = characteristic;
            break;
            
            
        }
    }
    
    
    log(message) {        
        this.logger.log(message);
    }

    error(message) {
        this.logger.error(message);
    }
    
    getVersion() {
        return this.version;
    }
    
    
}

class Logger {
    constructor(active) {
        this._logger = console;
        this.active = active
    }
    
    log(message) {
        if (!this.active) return;
        this._logger.log(message);
    }
    
    error(message) {       
        this._logger.error(message);
    }
}