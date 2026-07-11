export const isLicensePlateValidHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="Response">
  <Status>1</Status>
  <IsValid>true</IsValid>
  <IsProfane>false</IsProfane>
  <IsReserved>false</IsReserved>
  <IsMalformed>false</IsMalformed>
</Response>
`);
};

