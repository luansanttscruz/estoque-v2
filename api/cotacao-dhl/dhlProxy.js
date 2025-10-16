// api/cotacao-dhl/dhlProxy.js

function gerarXmlCotacao({ cidade, cep, valorDeclarado, peso }) {
  const dataHoje = new Date().toISOString().split('T')[0];

  return `
    <req:QuoteRequest xmlns:req="http://www.dhl.com">
      <Request>
        <ServiceHeader>
          <SiteID>${process.env.DHL_SITE_ID}</SiteID>
          <Password>${process.env.DHL_PASSWORD}</Password>
        </ServiceHeader>
      </Request>
      <From>
        <CountryCode>BR</CountryCode>
        <Postalcode>22251040</Postalcode>
        <City>Rio de Janeiro</City>
      </From>
      <To>
        <CountryCode>BR</CountryCode>
        <Postalcode>${cep}</Postalcode>
        <City>${cidade}</City>
      </To>
      <BkgDetails>
        <PaymentCountryCode>BR</PaymentCountryCode>
        <Date>${dataHoje}</Date>
        <ReadyTime>PT10H21M</ReadyTime>
        <DimensionUnit>CM</DimensionUnit>
        <WeightUnit>KG</WeightUnit>
        <Pieces>
          <Piece>
            <PieceID>1</PieceID>
            <Height>10</Height>
            <Depth>34</Depth>
            <Width>33</Width>
            <Weight>${peso}</Weight>
          </Piece>
        </Pieces>
        <IsDutiable>N</IsDutiable>
        <NetworkTypeCode>AL</NetworkTypeCode>
      </BkgDetails>
      <Dutiable>
        <DeclaredValue>${valorDeclarado}</DeclaredValue>
        <DeclaredCurrency>BRL</DeclaredCurrency>
      </Dutiable>
    </req:QuoteRequest>
  `.trim();
}

module.exports = { gerarXmlCotacao };
