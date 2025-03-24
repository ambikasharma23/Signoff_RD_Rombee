function generateSensorMask(tempSensor, humiditySensor, ambientSensor) {
    const bit0 = ambientSensor ? 1 : 0;
    const bit1 = tempSensor ? 1 : 0;
    const bit2 = humiditySensor ? 1 : 0;
    const bit3 = 1; // Always 1
    const bit4 = 1; // Always 1

    const binary = `${bit4}${bit3}${bit2}${bit1}${bit0}`;
    return parseInt(binary, 2);
}

// Function to generate commands
function generatingCommands(hostingLocation, locations, sensors, interrupt, ble, sampleMode, reportInterval, sampleInterval, prf, deviceType, latitude, longitude, motionInterval, stanstillInterval) {
    let commands = [];

    if (deviceType === "Router") {
        commands.push(`RBCFG:VVRMT;BSC,1,G2,9999,${prf},5242,-99;__SEQNUM__$`);

        if (locations.includes("GPS")) {
            commands.push(`RBCFG:VVRMT;GPS,1,${latitude},${longitude},101;__SEQNUM__$`);
        }
    } else if (deviceType === "Solar") {
        commands.push(`TIMER,0000,${motionInterval}:${stanstillInterval}:0:0#`);

        if (interrupt.includes("Ambient Light")) {
            commands.push("ALARM_SET,1,1,0,0#");
            commands.push("ALARM_SET,21,1,0,0#");
        } else {
            commands.push("ALARM_SET,1,0,0,0#");
            commands.push("ALARM_SET,21,0,0,0#");
        }

        if (ble === "ON") {
            commands.push("BLESCAN,1#");
            commands.push("BLESCAN,12,60,30#");
            commands.push("BLEWILDCARD,0:52420400,40,0000#");
        } else {
            commands.push("BLESCAN,0#");
        }
    } else {
        // Existing logic for other device types
        if (hostingLocation === "RB_US_Portal") {
            commands.push("AT+IP=0,aovx-listener.roambee.com,30009");
        } else {
            commands.push("AT+IP=0,aovx-listener.roambee.de,30009");
        }

        if (locations.includes("GPS")) {
            commands.push("AT+GNSSENABLE=1");
        } else {
            commands.push("AT+GNSSENABLE=0");
        }

        if (locations.includes("WIFI")) {
            commands.push("AT+WIFIENABLE=1,10");
        } else {
            commands.push("AT+WIFIENABLE=0,10");
        }

        const tempSensor = sensors.includes("Temperature");
        const humiditySensor = sensors.includes("Humidity");
        const ambientSensor = sensors.includes("Ambient Light");

        if (sensors.length === 0 || sensors.includes("None")) {
            commands.push("AT+SENSORMASK=0");
        } else {
            const sensorMask = generateSensorMask(tempSensor, humiditySensor, ambientSensor);
            commands.push(`AT+SENSORMASK=${sensorMask}`);
        }

        const gotShock = interrupt.includes("Shock");
        const gotAmbient = interrupt.includes("Ambient Light");

        if (gotShock) {
            commands.push("AT+MOTION=2,10,1800 & AT+VIBPARAM=1,0,217");
        } else {
            commands.push("AT+VIBPARAM=0,0,150");
        }

        if (gotAmbient) {
            commands.push("AT+LIGHT=1,500,900");
        } else {
            commands.push("AT+LIGHT=0,500,900");
        }

        if (ble === "ON") {
            commands.push("AT+BTENABLE=1,20");
        } else {
            commands.push("AT+BTENABLE=0,20");
        }

        if (sampleMode === "ON") {
            commands.push(`AT+SAMPLEMODE=1,1 & AT+TIMEGAP=0,${reportInterval},1,${sampleInterval}`);
        } else {
            commands.push(`AT+SAMPLEMODE=0,0 & AT+TIMEGAP=0,${prf},1,${prf}`);
        }
    }

    return commands;
}

async function submitForm() {
    try{
        function convertImageToPNG(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const reader = new FileReader();

                reader.onload = (event) => {
                    img.src = event.target.result;
                };

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    // Convert canvas to PNG data URL
                    const pngDataUrl = canvas.toDataURL('image/png');
                    resolve(pngDataUrl);
                };

                img.onerror = (error) => {
                    reject(error);
                };

                reader.readAsDataURL(file);
            });
        }

        // Function to embed an image in the PDF
        async function embedImage(pdfDoc, base64Image) {
            const imageBytes = await fetch(base64Image).then(res => res.arrayBuffer());
            return pdfDoc.embedPng(imageBytes);
        }
    const page1Data = JSON.parse(localStorage.getItem("page1Data"));
    const page2Data = JSON.parse(localStorage.getItem("page2Data"));
    const page3Data = JSON.parse(localStorage.getItem("page3Data"));
    const page4Data = {
        documentCreated: document.getElementById('documentCreated').value,
        lastUpdated: document.getElementById('lastUpdated').value,
        updatedBy: document.getElementById('updatedBy').value,
        createdByName: document.getElementById('createdByName').value,
        createdBySignature: await convertImageToPNG(document.getElementById('createdBySignature').files[0]),
        approvedByName: document.getElementById('approvedByName').value,
        approvedBySignature: await convertImageToPNG(document.getElementById('approvedBySignature').files[0]),
        approvalDate: document.getElementById('approvalDate').value
    };
   
        const formData = {
            page1: page1Data,
            page2: page2Data,
            page3: page3Data, 
            page4: page4Data,      
    };

        const commandsList = generatingCommands(
            formData.page1.hostingLocation,
            formData.page3.locations,
            formData.page3.sensors,
            formData.page3.interrupt,
            formData.page3.ble,
            formData.page3.sampleMode,
            formData.page3.reportInterval,
            formData.page3.sampleInterval,
            formData.page3.prf,
            formData.page3.deviceType,
            formData.page3.latitude,
            formData.page3.longitude,
            formData.page3.motionInterval,
            formData.page3.stanstillInterval
        );

        console.log("Form Data:", formData);
        console.log("Generated Commands:", commandsList);

        try {
            const existingPdfBytes = await fetch("rename.pdf").then(res => res.arrayBuffer());
            const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
            const [italicFont, boldFont, regularFont] = await Promise.all([
                pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaOblique),
                pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold),
                pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica)
            ]);
// Function to embed an image in the PDF
async function embedImage(pdfDoc, base64Image) {
    const imageBytes = await fetch(base64Image).then(res => res.arrayBuffer());
    return pdfDoc.embedPng(imageBytes);
}
            const pages = pdfDoc.getPages();
            let currentPage = pages[0];
            const { width, height } = currentPage.getSize();
            const fontSize = 11;
            const textColor = PDFLib.rgb(0, 0, 0);
            const lineHeight = 15;
            const headingFontSize = 16;
            const boxPadding = 5;
            const boxColor = PDFLib.rgb(1, 222 / 255, 89 / 255);
            const bottomMargin = 50;

            let yPos = height - 100;

            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            currentPage.drawText(formattedDate, {
                x: width - 200,
                y: yPos,
                size: fontSize,
                color: textColor,
                font: italicFont,
            });

            yPos -= lineHeight * 2;

            const drawSection = (title, data) => {
                console.log(`Drawing section: ${title}`);
                console.log("Data:", data);

                if (yPos < bottomMargin) {
                    currentPage = pdfDoc.addPage();
                    yPos = height - 50;
                }

                currentPage.drawText(title, {
                    x: 50,
                    y: yPos,
                    size: headingFontSize,
                    color: textColor,
                    font: boldFont
                });

                const textWidth = boldFont.widthOfTextAtSize(title, headingFontSize);
                currentPage.drawLine({
                    start: { x: 50, y: yPos - 2 },
                    end: { x: 50 + textWidth, y: yPos - 2 },
                    thickness: 1,
                    color: textColor,
                });

                yPos -= lineHeight + 10;

                Object.entries(data).forEach(([label, value]) => {
                    if (yPos < bottomMargin) {
                        currentPage = pdfDoc.addPage();
                        yPos = height - 50;
                    }

                    currentPage.drawText(label, {
                        x: 50,
                        y: yPos,
                        size: fontSize,
                        color: textColor,
                        font: boldFont,
                    });

                    const labelWidth = boldFont.widthOfTextAtSize(label, fontSize);
                    const valueWidth = regularFont.widthOfTextAtSize(value || "NA", fontSize); // Handle null/undefined
                    const boxX = 50 + labelWidth + 5;
                    const boxY = yPos - fontSize;

                    currentPage.drawRectangle({
                        x: boxX,
                        y: boxY,
                        width: valueWidth + boxPadding * 2,
                        height: fontSize + boxPadding * 2,
                        color: boxColor,
                        opacity: 0.5,
                    });

                    currentPage.drawText(value, {
                        x: boxX + boxPadding,
                        y: yPos,
                        size: fontSize,
                        color: textColor,
                        font: regularFont,
                    });

                    yPos -= lineHeight + 10;
                });
            };

            drawSection("User Account Information", {
                "Hosting Location: ": formData.page1.hostingLocation,
                "Honeycomb Role: ": formData.page1.honeycombRole,
                "User Name: ": formData.page1.userName,
                "Designation: ": formData.page1.designation,
                "Email: ": formData.page1.email,
                "Phone: ": formData.page1.phoneNumber,
                "SSO: ": formData.page1.ssoNeeded
            });

            drawSection("UseCase Information", {
                "Use Case: ": formData.page2.useCase || "NA",
                "Coverage: ": formData.page2.coverage|| "NA",
                "Shipment Using: ": formData.page2.shipmentUsing|| "NA",
                "Reverse Pickup: ": formData.page2.reversePickup|| "NA",
                "Number of Lanes: ": formData.page2.numberOfLanes|| "NA",
                "Supported Battery Life: ": formData.page2.supportedBatteryLife|| "NA",
            });
            
           // Modify the Device Configuration section like this:
const deviceConfig = {
    "Device Type: ": formData.page3.deviceType || "NA"
};

if (formData.page3.deviceType === "Router") {
    // Router specific fields
    deviceConfig["Locations: "] = formData.page3.locations?.length > 0 ? formData.page3.locations.join(", ") : "N/A";
    deviceConfig["PRF: "] = formData.page3.prf || "NA";
    
    if (formData.page3.locations?.includes("GPS")) {
        deviceConfig["Latitude: "] = formData.page3.latitude || "NA";
        deviceConfig["Longitude: "] = formData.page3.longitude || "NA";
    }
} else if (formData.page3.deviceType === "Solar") {
    // Solar specific fields
    deviceConfig["Interrupt: "] = formData.page3.interrupt?.length > 0 ? formData.page3.interrupt.join(", ") : "N/A";
    deviceConfig["BLE: "] = formData.page3.ble || "NA";
    deviceConfig["Motion Interval: "] = formData.page3.motionInterval || "NA";
    deviceConfig["Standstill Interval: "] = formData.page3.stanstillInterval|| "NA";
} else {
    // Default device fields
    deviceConfig["Locations: "] = formData.page3.locations?.length > 0 ? formData.page3.locations.join(", ") : "N/A";
    deviceConfig["Sensors: "] = formData.page3.sensors?.length > 0 ? formData.page3.sensors.join(", ") : "N/A";
    deviceConfig["Interrupt: "] = formData.page3.interrupt?.length > 0 ? formData.page3.interrupt.join(", ") : "N/A";
    deviceConfig["BLE: "] = formData.page3.ble || "NA";
    deviceConfig["Sample Mode: "] = formData.page3.sampleMode || "NA";
    
    if (formData.page3.sampleMode === "ON") {
        deviceConfig["Report Interval: "] = formData.page3.reportInterval || "NA";
        deviceConfig["Sample Interval: "] = formData.page3.sampleInterval || "NA";
    } else {
        deviceConfig["PRF: "] = formData.page3.prf || "NA";
    }
}
drawSection("Device Configuration", deviceConfig);

            const maxCommandLength = Math.max(...commandsList.map(command => command.length));
            const boxWidth = maxCommandLength * fontSize * 0.6 + boxPadding * 2;
            const boxHeight = commandsList.length * lineHeight + boxPadding;

            if (yPos < bottomMargin) {
                currentPage = pdfDoc.addPage();
                yPos = height - 50;
            }

            currentPage.drawText("Generated Commands", {
                x: 50,
                y: yPos,
                size: fontSize,
                color: textColor,
                font: boldFont,
            });

            const textWidthx = "Generated Commands".length * fontSize * 0.6;
            currentPage.drawLine({
                start: { x: 50, y: yPos - 5 },
                end: { x: 50 + textWidthx, y: yPos - 5 },
                thickness: 1,
                color: textColor,
            });

            yPos -= lineHeight + 8;

            currentPage.drawRectangle({
                x: 50 - boxPadding,
                y: yPos - boxHeight + lineHeight + boxPadding,
                width: boxWidth,
                height: boxHeight,
                color: boxColor,
                opacity: 0.5,
            });

            commandsList.forEach(command => {
                if (yPos < bottomMargin) {
                    currentPage = pdfDoc.addPage();
                    yPos = height - 50;

                    currentPage.drawRectangle({
                        x: 50 - boxPadding,
                        y: yPos - boxHeight + lineHeight + boxPadding,
                        width: boxWidth,
                        height: boxHeight,
                        color: boxColor,
                        opacity: 0.5,
                    });
                }

                currentPage.drawText(command, {
                    x: 50,
                    y: yPos,
                    size: fontSize,
                    color: textColor,
                });
                yPos -= lineHeight;
            });

            yPos -= boxPadding;
            yPos -= lineHeight * 3;
            
            drawSection("Document Sign Off", {
                "Document Created: ": formData.page4.documentCreated,
                "Last Updated: ": formData.page4.lastUpdated,
                "Updated By: ": formData.page4.updatedBy,
                "Created By: ": formData.page4.createdByName,
                "Approved By: ": formData.page4.approvedByName,
                "Approval Date: ": formData.page4.approvalDate
            });
           
            currentPage.drawText("Created by Sign:", {
                x: 50, // Left side
                y: yPos - 10, // Position above the signature image
                size: fontSize,
                color: textColor,
                font: boldFont,
            });
            
            currentPage.drawText("Approved by Sign:", {
                x: 350, // Right side
                y: yPos - 10, // Position above the signature image
                size: fontSize,
                color: textColor,
                font: boldFont,
            });
            // Embed signatures
            const createdBySignatureImage = await embedImage(pdfDoc, formData.page4.createdBySignature);
            const approvedBySignatureImage = await embedImage(pdfDoc, formData.page4.approvedBySignature);

            currentPage.drawImage(createdBySignatureImage, {
                x: 50,
                y: yPos - 70,
                width: 100,
                height: 50,
            });

            currentPage.drawImage(approvedBySignatureImage, {
                x: 350,
                y: yPos - 70,
                width: 100,
                height: 50,
            });

            yPos -= 120;



// const modifiedPdfBytes = await pdfDoc.save();
const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
            saveAs(blob, "rename_modified.pdf");

            console.log("PDF modified successfully!");
            window.location.href = "thankyou.html";

            localStorage.removeItem('page1Data');
            localStorage.removeItem('page2Data');
            localStorage.removeItem('page3Data');
        } catch (error) {
            console.error("Error modifying PDF:", error);
            alert("Error modifying PDF: " + error.message);
        }
     
}catch (error) {
        console.error("Error in submitForm:", error);
    }
}
