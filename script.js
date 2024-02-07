const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { ByteLengthParser } = require('@serialport/parser-byte-length');
const { CCTalkParser } = require('@serialport/parser-cctalk')
const { InterByteTimeoutParser } = require('@serialport/parser-inter-byte-timeout')

const { ipcRenderer } = require('electron');

var indexConnect = 0;

let port;

function printTables() {
    window.print();
}

function updateDateTime() {
    var currentDate = new Date();
    var day = currentDate.getDate();
    var month = currentDate.getMonth() + 1; // Months are zero-based
    var year = currentDate.getFullYear();
    var hours = currentDate.getHours();
    var minutes = currentDate.getMinutes();
    var seconds = currentDate.getSeconds();

    // Formatting single-digit days, months, hours, minutes, and seconds with leading zero
    day = (day < 10) ? '0' + day : day;
    month = (month < 10) ? '0' + month : month;
    hours = (hours < 10) ? '0' + hours : hours;
    minutes = (minutes < 10) ? '0' + minutes : minutes;
    seconds = (seconds < 10) ? '0' + seconds : seconds;

    var formattedDateTime = day + '/' + month + '/' + year + ' ' + hours + ':' + minutes + ':' + seconds;

    // Menampilkan waktu di elemen dengan id "currentDateTime"
    document.getElementById('waktuPengujian').innerText = formattedDateTime;
}

// Memanggil fungsi updateDateTime() setiap detik
setInterval(updateDateTime, 1000);

// Memanggil updateDateTime() saat halaman dimuat untuk menampilkan waktu awal
window.onload = updateDateTime;

document.addEventListener('DOMContentLoaded', () => {
    const comPortDropdown = document.getElementById('comPortDropdown');
    let serialConnection;
    // Minta daftar COM Port dari modul serialport
    SerialPort.list().then((ports) => {
        ports.forEach((port) => {
            const option = document.createElement('option');
            option.value = port.path;
            option.textContent = port.path;
            comPortDropdown.appendChild(option);
        });
    });

    // Mendengarkan perubahan pada COM Port yang dipilih
    comPortDropdown.addEventListener('change', async (event) => {
        const selectedPort = event.target.value;
        console.log(selectedPort);

        // // Tutup koneksi serial jika sudah ada
        document.getElementById(`statusKomunikasi`).innerText = `Tidak Terhubung`;

        if (port) {
            await port.close();
        }

        // Buat koneksi baru dengan COM Port yang dipilih
        port = new SerialPort({
            path: selectedPort,
            baudRate: 9600, // Sesuaikan dengan baud rate yang dibutuhkan
        });

        document.getElementById(`statusKomunikasi`).innerText = `Terhubung`;

        const standarTegBaterai = 3.200;
        const standarTegTotalBaterai = 26.500;
        const standarArusMaksimumBaterai = 40.00;
        const standarKapBaterai = 120;
        const standarSelisihCell = 0.200;

        var index = 0;
        var indexKelulusan = 0;

        const queryBasic = ['DD', 'A5', '03', '00', 'FF', 'FD', '77']
        const queryCell = ['DD', 'A5', '04', '00', 'FF', 'FC', '77']

        var batteryVoltage;
        var currentBattery = 0.0;
        var newCurrentBattery = 0.0;
        var nominalCapacity;
        var fullCapacity;
        var cellVoltage = [];
        var averageCellVoltage = 0;

        var selisihCellVoltage = 0;
        var nilaiTertinggiCell = 0;
        var nilaiTerendahCell = 4;

        function kirimDataHexa(hexString) {
            const buffer = Buffer.from(hexString, 'hex');

            port.write(buffer, (err) => {
                if (err) {
                    return console.log('Error:', err.message);
                }
            });
        }

        const parser = port.pipe(new InterByteTimeoutParser({ interval: 200 }))
        // const parser = port.pipe(new ByteLengthParser({ length: 46 }))
        // const parser = port.pipe(new CCTalkParser(1000))

        parser.on('data', (data) => {
            const asciiData = data;
            const hexArray = [];
            for (let i = 0; i < asciiData.length; i += 2) {
                hexArray.push(parseInt(asciiData.slice(i, i + 2).toString('hex'), 16));
            }

            console.log(hexArray);

            if ((hexArray[1] !== 38) || (hexArray[1] !== 16)) 
            {
                document.getElementById(`statusKomunikasi`).innerText = `Tidak Terhubung`;                
            }

            switch (hexArray[1]) {
                case 38:
                    parseBasic(hexArray)
                    document.getElementById(`statusKomunikasi`).innerText = `Terhubung`;
                    indexConnect = 0;
                    break;
                case 16:
                    parseCellVoltage(hexArray)
                    document.getElementById(`statusKomunikasi`).innerText = `Terhubung`;
                    indexConnect = 0;
                    break;
            }
        })

        function parseBasic(array) {
            batteryVoltage = array[2] / 100;
            newCurrentBattery = (array[3] / 100);
            if (newCurrentBattery > 500) {
                newCurrentBattery = (newCurrentBattery - 655.3).toFixed(3);
                document.getElementById(`statusBaterai`).innerText = `Disharging(${newCurrentBattery})`;
            }else
            {
                document.getElementById(`statusBaterai`).innerText = `Charging(${newCurrentBattery})`;
            }
            nominalCapacity = array[4] / 100;
            fullCapacity = array[5] / 100;

            document.getElementById(`valueTegBaterai`).innerText = `${batteryVoltage} VDC`;
            if (batteryVoltage >= standarTegTotalBaterai) {
                document.getElementById(`statusTegBaterai`).innerText = `LULUS`;
                document.getElementById(`statusTegBaterai`).style.color = `black`;
                document.getElementById(`statusTegBaterai`).style.backgroundColor = `green`;
                indexKelulusan++;
            } else {
                document.getElementById(`statusTegBaterai`).innerText = `TIDAK LULUS`;
                document.getElementById(`statusTegBaterai`).style.color = `black`;
                document.getElementById(`statusTegBaterai`).style.backgroundColor = `red`;
            }

            // document.getElementById(`valueArusBaterai`).innerText = `${(newCurrentBattery).toFixed(2)} A`;
            // // if (newCurrentBattery === 0) {
            //     document.getElementById(`statusArusBaterai`).innerText = `LULUS`;
            //     document.getElementById(`statusArusBaterai`).style.color = `white`;
            //     document.getElementById(`statusArusBaterai`).style.backgroundColor = `green`;
            //     indexKelulusan++;
            // } else {
            //     document.getElementById(`statusArusBaterai`).innerText = `TIDAK LULUS`;
            //     document.getElementById(`statusArusBaterai`).style.color = `white`;
            //     document.getElementById(`statusArusBaterai`).style.backgroundColor = `red`;
            // }

            // document.getElementById(`valueArusMaxBaterai`).innerText = `${(currentBattery).toFixed(2)} A`;
            // if (currentBattery >= standarArusMaksimumBaterai) {
            //     document.getElementById(`statusArusMaxBaterai`).innerText = `LULUS`;
            //     document.getElementById(`statusArusMaxBaterai`).style.color = `white`;
            //     document.getElementById(`statusArusMaxBaterai`).style.backgroundColor = `green`;
            //     indexKelulusan++;
            // } else {
            //     document.getElementById(`statusArusMaxBaterai`).innerText = `TIDAK LULUS`;
            //     document.getElementById(`statusArusMaxBaterai`).style.color = `white`;
            //     document.getElementById(`statusArusMaxBaterai`).style.backgroundColor = `red`;
            // }

            document.getElementById(`valueKapBaterai`).innerText = `${nominalCapacity} Ah`;
            if (nominalCapacity >= standarKapBaterai) {
                document.getElementById(`statusKapBaterai`).innerText = `LULUS`;
                document.getElementById(`statusKapBaterai`).style.color = `black`;
                document.getElementById(`statusKapBaterai`).style.backgroundColor = `green`;
                indexKelulusan++;
            } else {
                document.getElementById(`statusKapBaterai`).innerText = `TIDAK LULUS`;
                document.getElementById(`statusKapBaterai`).style.color = `black`;
                document.getElementById(`statusKapBaterai`).style.backgroundColor = `red`;
            }

            console.log('======================= BASIC PARAMETER ==============================');
            console.log(`TEGANGAN BATERAI : ${batteryVoltage} V`);
            console.log(`ARUS BATERAI : ${newCurrentBattery} A`);
            console.log(`KAPASITAS SAAT INI : ${nominalCapacity} Ah`);
            console.log(`KAPASITAS PENUH : ${fullCapacity} Ah`);
            console.log('======================================================================');
            console.log();
        }

        function parseCellVoltage(array) {
            console.log('======================== TEGANGAN CELL ===============================');
            for (let nCell = 1; nCell < 9; nCell++) {
                averageCellVoltage += (array[nCell + 1]);
                document.getElementById(`valueC${nCell}`).innerText = `${(array[nCell + 1] / 1000).toFixed(3)} V`;
                cellVoltage[nCell] = array[nCell + 1] / 1000;
                if (nilaiTertinggiCell < cellVoltage[nCell]) {
                    nilaiTertinggiCell = cellVoltage[nCell];
                }
                if (nilaiTerendahCell > cellVoltage[nCell]) {
                    nilaiTerendahCell = cellVoltage[nCell];
                }
                if (cellVoltage[nCell] >= standarTegBaterai) {
                    document.getElementById(`statusC${nCell}`).innerText = `LULUS`;
                    document.getElementById(`statusC${nCell}`).style.color = `black`;
                    document.getElementById(`statusC${nCell}`).style.backgroundColor = `green`;
                    indexKelulusan++;
                } else {
                    document.getElementById(`statusC${nCell}`).innerText = `TIDAK LULUS`;
                    document.getElementById(`statusC${nCell}`).style.color = `black`;
                    document.getElementById(`statusC${nCell}`).style.backgroundColor = `red`;
                }
                console.log(`CELL ${nCell} : ${cellVoltage[nCell].toFixed(3)} V`);
            }
            averageCellVoltage = averageCellVoltage / 8;
            averageCellVoltage = (averageCellVoltage / 1000).toFixed(3);

            selisihCellVoltage = nilaiTertinggiCell - nilaiTerendahCell;
            selisihCellVoltage = selisihCellVoltage.toFixed(3)
            nilaiTerendahCell = 4;
            nilaiTertinggiCell = 0;
            if (averageCellVoltage >= standarTegBaterai) {
                document.getElementById(`statusAverage`).innerText = `LULUS`;
                document.getElementById(`statusAverage`).style.color = `black`;
                document.getElementById(`statusAverage`).style.backgroundColor = `green`;
                indexKelulusan++;
            } else {
                document.getElementById(`statusAverage`).innerText = `TIDAK LULUS`;
                document.getElementById(`statusAverage`).style.color = `black`;
                document.getElementById(`statusAverage`).style.backgroundColor = `red`;
            }

            if (selisihCellVoltage < standarSelisihCell) {
                document.getElementById(`statusSelisih`).innerText = `LULUS`;
                document.getElementById(`statusSelisih`).style.color = `black`;
                document.getElementById(`statusSelisih`).style.backgroundColor = `green`;
                indexKelulusan++;
            } else {
                document.getElementById(`statusSelisih`).innerText = `TIDAK LULUS`;
                document.getElementById(`statusSelisih`).style.color = `black`;
                document.getElementById(`statusSelisih`).style.backgroundColor = `red`;
            }

            console.log(indexKelulusan);
            if (indexKelulusan === 12) {
                document.getElementById(`serialNumber`).innerText = `Serial Number : 230100801729`;

                document.getElementById(`bgHasilPengujian`).innerText = `LULUS`;
                document.getElementById(`bgHasilPengujian`).style.color = `white`;
                document.getElementById(`bgHasilPengujian`).style.backgroundColor = `green`;
            } else {
                document.getElementById(`bgHasilPengujian`).innerText = `TIDAK LULUS`;
                document.getElementById(`bgHasilPengujian`).style.color = `white`;
                document.getElementById(`bgHasilPengujian`).style.backgroundColor = `red`;
            }
            indexKelulusan = 0;

            document.getElementById(`valueAverage`).innerText = `${averageCellVoltage} V`;
            document.getElementById(`valueSelisih`).innerText = `${selisihCellVoltage} V`;
            console.log(`AVERAGE CELL VOLTAGE : ${averageCellVoltage} V`);
            averageCellVoltage = 0;
            console.log('======================================================================');
            console.log();
        }

        setInterval(() => {
            index++;
            indexConnect++;
            if (indexConnect > 3) 
            {
                document.getElementById(`statusKomunikasi`).innerText = `Tidak Terhubung`;   
            }
            switch (index) {
                case 1:
                    for (let indexQuery = 0; indexQuery < queryBasic.length; indexQuery++) {
                        kirimDataHexa(queryBasic[indexQuery]);
                    }
                    break;
                case 2:
                    for (let indexQuery = 0; indexQuery < queryBasic.length; indexQuery++) {
                        kirimDataHexa(queryCell[indexQuery]);
                        index = 0;
                    }
                    break;
            }
        }, 1000);

        ipcRenderer.send('comPortSelected', selectedPort);
    });
});
