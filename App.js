import React from 'react';
import {
    View,
    Text,
    NativeModules,
    NativeEventEmitter,
    TouchableOpacity,
    StyleSheet
} from 'react-native';
import BleManager from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const AccelerometerService = "34802252-7185-4D5D-B431-630E7050E8F0"
const NotificationCharacteristic = "34800002-7185-4D5D-B431-630E7050E8F0"
const WriteCharacteristic = "34800001-7185-4D5D-B431-630E7050E8F0"

const BleScanDuration = 5 //seconds

export default class App extends React.Component{
    constructor(props){
        super(props)
        this.state={
            isScanning: false,
            isConnected: false,
            isSubscribed: false,
            discoveredDeviceList: [],
            selectedDevice: {},
            x: 0,
            y: 0,
            z: 0
        }
    }

    componentDidMount(){
        BleManager.start({showAlert: false});
        bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.onDeviceDiscovered);
        bleManagerEmitter.addListener('BleManagerStopScan', this.onDeviceScanStop );
        bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.onAccDataReceive );
    }

    onAccDataReceive = ({value, peripheral, characteristic, service}) =>{
        let rawValue = Uint8Array.from(value)
        if(rawValue.length > 2){
            let dataArray = rawValue.subarray(0,2)
            let dataBuffer = dataArray.buffer
            let dataView = new DataView(dataBuffer)
            let numberOfRecord = (rawValue.byteLength - 6) / (3*4)
            if (numberOfRecord === 2){
                for(let i = 0; i < 2; i++){
                    let x = dataView.getFloat32(6 + i * 12, true).toFixed(4)
                    let y = dataView.getFloat32(6 + i * 12 + 4, true).toFixed(4)
                    let z = dataView.getFloat32(6 + i * 12 + 8, true).toFixed(4)
                    this.setState({x: x, y: y, z: z})
                }
            }
        }
    }
        
    unsubscribeToAcceleromter = () =>{
        BleManager.write(this.state.selectedDevice.id, AccelerometerService, WriteCharacteristic,[2, 99])
        .then(() => { console.log("Unsubscribed to Accelerometer"); })
        .catch((error) => { console.log('error msg: ', error) });
    }


    subscribeToAcceleromter = () =>{
        let subscribeToAcc = [1, 99, 47, 77, 101, 97, 115, 47, 65, 99, 99, 47, 50, 54]
        BleManager.write(this.state.selectedDevice.id, AccelerometerService, WriteCharacteristic, subscribeToAcc)
        .then(() => { console.log("Subscribed to Acceleromter"); })
        .catch((error) => { console.log('error msg: ', error) });
    }


    onDeviceScanStop = () => {
        this.setState({isScanning: false})
    }

    onDeviceScanStart = () =>{
        BleManager.scan([], BleScanDuration, true)
        .then(() => { console.log("Scan started"); });
    }

    onDeviceDiscovered = (device) => {
        if(device.advertising.isConnectable == 1 ) {            
            let discoveredDeviceNames = this.state.discoveredDeviceList.map(a => a.name)
            if(!discoveredDeviceNames.includes(device.name)){
                this.setState({
                    discoveredDeviceList: [...this.state.discoveredDeviceList, device] 
                })
            }
        }
    }

    onDevicePressed = (item) => {
        if(item.name.includes("Movesense")){
            this.setState({selectedDevice: item})
        }else{
            window.alert("Choose Movesense Device")
        }
        
    }

    onDeviceConnectPressed = () =>{
        BleManager.connect(this.state.selectedDevice.id)
        .then(() => {
            BleManager.retrieveServices(this.state.selectedDevice.id)
            .then(data => {
                BleManager.startNotification(this.state.selectedDevice.id, AccelerometerService, NotificationCharacteristic)
                    .then(() => {
                        console.log('Connected to ' + this.state.selectedDevice.name);
                        this.setState({isConnected: true})
                    })
                    .catch((error) => { console.log("Notification start error", error); });
            })
        }).catch((error) => { console.log('Connection error', error); });
    }

    onScanButtonPressed = () =>{
        if(this.state.isScanning){
            BleManager.stopScan()
        }else{
            this.onDeviceScanStart()
        }
        this.setState({isScanning: !this.state.isScanning})
    }

    onDataStartClicked = () =>{
        if(this.state.isSubscribed){
            this.unsubscribeToAcceleromter()
        }else{
            this.subscribeToAcceleromter()
        }
        this.setState({isSubscribed: !this.state.isSubscribed})
    }
    disconnectDevice = async () =>{
        await this.unsubscribeToAcceleromter()
        let result = await BleManager.disconnect(this.state.selectedDevice.id)
    }

    componentWillUnmount(){
        this.disconnectDevice()
    }

    render(){
        return(
            <View style={styles.container}>
                <Text>USING REACT NATIVE</Text>
                <TouchableOpacity onPress={this.onScanButtonPressed}>
                    <Text>{this.state.isScanning ? "Stop" : "Scan"}</Text>
                </TouchableOpacity>

                <View style={styles.deviceListView}>
                    {this.state.discoveredDeviceList.map((item, index) => {
                        return(
                            <TouchableOpacity 
                                key={index}
                                style={this.state.selectedDevice.id === item.id ? styles.clickedDeviceButton : styles.deviceButton} 
                                onPress={()=>this.onDevicePressed(item)}
                            >
                                <Text>{item.name}</Text>
                            </TouchableOpacity>                                    
                        )
                    })}
                </View>

                {this.state.selectedDevice.name && 
                    <View>
                        <TouchableOpacity 
                            style={styles.connectButton}
                            onPress={this.onDeviceConnectPressed}
                        >
                            <Text>Connect to {this.state.selectedDevice.name}</Text>
                        </TouchableOpacity>
                    </View>
                }
                {this.state.isConnected && 
                    <View>
                        <View>
                            <TouchableOpacity
                                onPress={this.onDataStartClicked}
                                style={styles.connectButton}
                            >
                                <Text>{this.state.isSubscribed ? "Stop" : "Start"}</Text>
                            </TouchableOpacity>
                        </View>
                        <View>
                            <Text>x: {this.state.x}. y: {this.state.y}, z: {this.state.z}</Text>
                        </View>
                    </View>
                }

            </View>
        )
    }
}

const styles = StyleSheet.create({
    container: {
        flex:1, 
        backgroundColor:"white", 
        justifyContent:"center", 
        alignItems:"center"
    },
    deviceListView:{
        height: "30%",
        width: "100%",
        alignItems: "center"
    },
    clickedDeviceButton: {
        backgroundColor: "grey",
        borderWidth: 1,
        width: "70%",
        alignItems: 'center',
        marginBottom: 10
    },
    deviceButton: {
        borderWidth: 1,
        width: "70%",
        alignItems: 'center',
        marginBottom: 10
    },
    connectButton:{
        padding: 10,
        borderWidth: 1
    }
})