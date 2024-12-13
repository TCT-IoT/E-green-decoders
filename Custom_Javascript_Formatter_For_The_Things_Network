function decodeUplink(input) {
    // Convert the byte array into a hexadecimal string
    var hexData = input.bytes.map(byte => ('0' + byte.toString(16)).slice(-2)).join('').toUpperCase();

    if (hexData.length < 2) {
        return { errors: ["Payload too short."] };
    }

    // Measurement type dictionary
    var typeReferences = {
        0x8: 'Temperature',
        0xA: 'Voltage',
        0xB: 'Current'
    };

    // Measurement divisors
    var dividerReferences = {
        'Temperature': 100,
        'Voltage': 1000,
        'Current': 100
    };

    // Error codes dictionary
    var errorCodes = {
        0x81: { code: "ERR_UNKNOWN", description: "Unknown error." },
        0x82: { code: "ERR_BUF_SMALLER", description: "Data buffer is full; cannot write more data." },
        0x83: { code: "ERR_DEPTH_HISTORIC_OUT_OF_RANGE", description: "Historic depth is too large or too small." },
        0x84: { code: "ERR_NB_SAMPLE_OUT_OF_RANGE", description: "Number of samples is too large or too small." },
        0x85: { code: "ERR_NWAY_OUT_OF_RANGE", description: "Number of channels is out of range." },
        0x86: { code: "ERR_TYPEWAY_OUT_OF_RANGE", description: "Measurement type is out of range." },
        0x87: { code: "ERR_SAMPLING_PERIOD", description: "Incorrect sampling period structure." },
        0x88: { code: "ERR_SUBTASK_END", description: "End of a subtask after exiting an infinite loop." },
        0x89: { code: "ERR_NULL_POINTER", description: "Pointer has a NULL value." },
        0x8A: { code: "NA", description: "Not defined." },
        0x8B: { code: "ERR_EEPROM", description: "EEPROM is corrupted." },
        0x8C: { code: "ERR_ROM", description: "ROM is corrupted." },
        0x8D: { code: "ERR_RAM", description: "RAM is corrupted." },
        0x8E: { code: "ERR_ARM_INIT_FAIL", description: "Failed to initialize the radio module." },
        0x8F: { code: "ERR_ARM_BUSY", description: "Module is busy (possibly uninitialized)." },
        0x90: { code: "ERR_ARM_BRIDGE_ENABLE", description: "Module is in bridge mode; cannot send data via radio." },
        0x91: { code: "ERR_RADIO_QUEUE_FULL", description: "Radio buffer is full." },
        0x92: { code: "ERR_CFG_BOX_INIT_FAIL", description: "Failed to initialize the black box." },
        0x93: { code: "NA", description: "Not defined." },
        0x94: { code: "NA", description: "Not defined." },
        0x95: { code: "NA", description: "Not defined." },
        0x96: { code: "ERR_ARM_TRANSMISSION", description: "A transmission was initiated but failed." },
        0x97: { code: "ERR_ARM_PAYLOAD_BIGGER", description: "Message size exceeds network capacity." },
        0x98: { code: "ERR_RADIO_PAIRING_TIMEOUT", description: "Failed to pair with the network within the allotted time." }
    };

    // Function to decode a signed 16-bit big-endian integer
    function decodeSigned16(highHex, lowHex) {
        var high = parseInt(highHex, 16);
        var low = parseInt(lowHex, 16);
        var val = (high << 8) | low;
        if (val & 0x8000) {
            val = val - 0x10000;
        }
        return val;
    }

    var dataIndex = 0;
    var decodedData = {};

    // Read the first byte
    var firstByteHex = hexData.substring(dataIndex, dataIndex + 2);
    dataIndex += 2;
    var firstByte = parseInt(firstByteHex, 16);

    // Decompose the first byte
    var bit7 = (firstByte & 0x80) >> 7; 
    var bit6 = (firstByte & 0x40) >> 6; // Timestamp
    var bit5 = (firstByte & 0x20) >> 5; // 1 = measurement, 0 = other (alert, error, etc.)
    var lowNibble = (firstByte & 0x0F); // 4 least significant bits

    // Read the timestamp if present
    if (bit6 === 1) {
        if (dataIndex + 8 > hexData.length) {
            return { errors: ["Payload too short to read the timestamp."] };
        }
        var timestampHex = hexData.substring(dataIndex, dataIndex + 8);
        dataIndex += 8;
        var timestamp = parseInt(timestampHex, 16);
        var timestampDate = new Date(timestamp * 1000).toISOString();
        decodedData.timestamp = timestamp;
        decodedData.timestampDate = timestampDate;
    }

    if (bit5 === 1) {
        // Measurement frame
        var numSamples = (firstByte & 0x07) + 1;
        decodedData.numSamples = numSamples;

        // Read additional data if multiple samples
        if (numSamples > 1) {
            if (dataIndex + 4 > hexData.length) {
                return { errors: ["Payload too short to read the sampling period."] };
            }
            var periodHex = hexData.substring(dataIndex, dataIndex + 4);
            dataIndex += 4;
            var period = parseInt(periodHex, 16);
            decodedData.samplingPeriodMinutes = period;
        }

        // Read measurements
        while (dataIndex < hexData.length) {
            if (dataIndex + 2 > hexData.length) {
                return { errors: ["Payload truncated; cannot read measurement type."] };
            }

            var measureTypeHex = hexData.substring(dataIndex, dataIndex + 2);
            dataIndex += 2;
            var measureType = parseInt(measureTypeHex, 16);

            if (!typeReferences[measureType]) {
                return { errors: ["Unknown measurement type: " + measureTypeHex] };
            }

            var measureValues = [];
            for (var i = 0; i < numSamples; i++) {
                if (dataIndex + 4 > hexData.length) {
                    return { errors: ["Payload truncated; not enough data for measurements."] };
                }

                var highHex = hexData.substring(dataIndex, dataIndex + 2);
                var lowHex = hexData.substring(dataIndex + 2, dataIndex + 4);
                dataIndex += 4;

                var rawValue = (measureType === 0x8) ? decodeSigned16(highHex, lowHex) : (parseInt(highHex, 16) << 8 | parseInt(lowHex, 16));
                var value = rawValue / dividerReferences[typeReferences[measureType]];
                measureValues.push(value);
            }

            decodedData[typeReferences[measureType]] = (numSamples === 1) ? measureValues[0] : measureValues;
        }
    } else {
        // Not a measurement frame
        if (lowNibble === 0xE) {
            // General error frame
            if (dataIndex + 2 > hexData.length) {
                return { errors: ["Payload too short to read error frame."] };
            }

            var errorInfoHex = hexData.substring(dataIndex, dataIndex + 2);
            dataIndex += 2;
            var errorInfo = parseInt(errorInfoHex, 16);

            var errorIndex = (errorInfo & 0xE0) >> 5;
            var errorLength = errorInfo & 0x1F;

            decodedData.errorIndex = errorIndex;
            decodedData.errorLength = errorLength;

            if (dataIndex + 2 > hexData.length) {
                return { errors: ["Payload too short to read error code."] };
            }

            var errorCodeHex = hexData.substring(dataIndex, dataIndex + 2);
            dataIndex += 2;
            var errorCode = parseInt(errorCodeHex, 16);
            var errorDetails = errorCodes[errorCode] || { code: "UNKNOWN_ERROR", description: "Unrecognized error code." };

            decodedData.errorCode = errorDetails.code;
            decodedData.errorDescription = errorDetails.description;

            if (errorLength > 0) {
                var messageLengthHex = errorLength * 2;
                if (dataIndex + messageLengthHex > hexData.length) {
                    return { errors: ["Payload truncated; not enough data for error message."] };
                }
                decodedData.errorMessage = hexData.substring(dataIndex, dataIndex + messageLengthHex);
                dataIndex += messageLengthHex;
            }
        } else {
            decodedData.frameType = "Unsupported or reserved frame type: 0x" + lowNibble.toString(16).toUpperCase();
        }
    }

    return {
        data: decodedData
    };
}
