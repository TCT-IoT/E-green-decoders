var hexData = msg.payload;
var devAddr = msg.rawdata.deveui;

// We want to retrieve the last 5 characters of the deveui
devAddr = devAddr.substring(devAddr.length - 5);

var hexToDecimal = hex => parseInt(hex, 16);
hexData = hexData.toUpperCase();

// Possible measurement types
// These values come from the sensor's LoRa documentation.
var typeReferences = {
    '08': devAddr + ':temperature',
    '0A': devAddr + ':voltage',
    '0B': devAddr + ':current'
};

// Corresponding values to get °C, V, and A
// The values returned by the sensor are in hundredths of a degree, thousandths of Volts, and thousandths of Amps
// These values come from the sensor's LoRa documentation
var dividerReferences = {
    '08': 100,
    '0A': 1000,
    '0B': 100
};

// Frame parameters
// a0 = Measurement frame, no history, 1 sample
var currentDate = new Date();
var loraPacketType = hexData[0] + hexData[1];
var nbSamples = hexToDecimal(hexData[1]) + 1;

// If we have more than one sample, we retrieve the transmission frequency
var emissionFrequency = 0;
if (nbSamples > 1) {
    emissionFrequency = hexToDecimal(hexData[2] + hexData[3] + hexData[4] + hexData[5]) / nbSamples;
}

// Formatted data
var decryptedDatas = {};
var dataIndex = 2 + (nbSamples > 1 ? 4 : 0);
var readingDataType = 0;

// Each data point is coded on x bits, 2 bits for the data type and 4*nbSamples for the value
while (dataIndex < hexData.length) {
    // Retrieve the data type
    var dataTypeValue = hexData[dataIndex] + hexData[dataIndex + 1];
    // Then the human-readable correspondence
    var dataType = typeReferences[dataTypeValue];
    dataIndex += 2;
    decryptedDatas[readingDataType] = [];
    var stopReadingValues = dataIndex + 4 * nbSamples;

    while (dataIndex < stopReadingValues) {
        var currentValues = {};
        // Next, retrieve the measurement value
        var data = "";
        var stopReadingDigit = dataIndex + 4;
        while (dataIndex < stopReadingDigit) {
            data += hexData[dataIndex];
            dataIndex += 1;
        }
        // Finally, convert the measurement to decimal and divide it to work with the desired units
        var decimalData = parseInt(data, 16);
        currentValues[dataType] = decimalData / dividerReferences[dataTypeValue];
        decryptedDatas[readingDataType].push(currentValues);
    }
    readingDataType += 1;
}

var combinedData = {};
var keys = Object.keys(decryptedDatas);

for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var data = decryptedDatas[key];
    for (var i = 0; i < data.length; i++) {
        var dataType = Object.keys(data[i])[0];
        if (combinedData[i] === undefined) {
            combinedData[i] = {};
        }
        combinedData[i][dataType] = data[i][dataType];
    }
}

var messages = [];
for (var i = 0; i < nbSamples; i++) {
    var sampleDate = new Date();
    sampleDate.setMinutes(currentDate.getMinutes() - emissionFrequency * (nbSamples - i - 1));
    var sample = {};
    sample.payload = {
        'd': {},
        'ts': sampleDate.toISOString()
    };
    sample.payload['d'][devAddr] = {};
    sample.payload['d'][devAddr]['Val'] = {};
    sample.payload['d'][devAddr]['Val'] = combinedData[i];
    sample['topic'] = msg.topic;
    messages.push(sample);
}

return [messages];
