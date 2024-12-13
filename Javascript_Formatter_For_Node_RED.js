

var hexData = msg.payload;
var devAddr = msg.rawdata.devaddr;


// We want to retrieve the last 8 caracters of the devAddr
devAddr = devAddr.substring(devAddr.length - 8);

var hexToDecimal = hex => parseInt(hex, 16);

hexData = hexData.toUpperCase();

// Types de mesures possibles
// Ces valeurs viennent de la documentation Lora du capteur.
var typeReferences = {
    '08': 'Temperature:'+devAddr,
    '0A': 'Tension:'+devAddr,
    '0B': 'Courant:'+devAddr
};

// Correspondance des valeurs pour obtenir des °C, V et A
// Les valeurs renvoyées par le capteur sont en centième de degré, millième de Volts et millèmes d'ampères
// Ces valeurs viennent de la documentation Lora du capteur
var dividerReferences = {
    '08': 100,
    '0A': 1000,
    '0B': 100
};

// Paramètres de la trame
// a0 = Trame de mesure, pas d'historique, 1 échantillon

var currentDate = new Date();
var loraPacketType = hexData[0] + hexData[1];
var nbSamples = hexToDecimal(hexData[1])+1;
// Si on a plus d'un échantillon, on récupère la fréquence d'émission

var emissionFrequency = 0;
if(nbSamples > 1) {
    emissionFrequency = hexToDecimal(hexData[2] + hexData[3] + hexData[4] + hexData[5]) / nbSamples;
}

// Données formattées
var decryptedDatas = {};

var dataIndex = 2 + (nbSamples > 1 ? 4 : 0);
var readingDataType = 0;
// Chaque donnée est codée sur x bits, 2 bits pour le type de la donnée et 4*nbSamples pour la valeur
while (dataIndex < hexData.length) {
    // On récupère le type de donnée
    var dataTypeValue = hexData[dataIndex] + hexData[dataIndex+1];
    // Puis la correspondance human readable
    var dataType = typeReferences[dataTypeValue];
    dataIndex += 2;
    decryptedDatas[readingDataType] = [];

    var stopReadingValues = dataIndex + 4*nbSamples;

    while(dataIndex < stopReadingValues) {
        var currentValues= {};

        // Ensuite on récupère la valeur de la mesure
        var data = "";
        var stopReadingDigit = dataIndex + 4;
        while (dataIndex < stopReadingDigit) {
            data += hexData[dataIndex];
            dataIndex += 1;
        }
        // Enfin on convertit la mesure en décimal et on la divise pour travailler avec les unités qui nous intéressent
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
        if(combinedData[i] === undefined) {
            combinedData[i] = {};
        }
        combinedData[i][dataType] = data[i][dataType];
    }
}

var messages = [];
for (var i= 0; i < nbSamples; i++) {
    var sampleDate = new Date();
    sampleDate.setMinutes(currentDate.getMinutes() - emissionFrequency * (nbSamples - i-1));

    var sample = {};
    sample.payload = {
        'd': {},
        'ts': sampleDate.toISOString()
    };
    sample.payload['d'][devAddr] = {};
    sample.payload['d'][devAddr]['Val'] = {};

    sample.payload['d'][devAddr]['Val'] = combinedData[i];
    messages.push(sample);
}

msg.payload = messages;

return msg;
