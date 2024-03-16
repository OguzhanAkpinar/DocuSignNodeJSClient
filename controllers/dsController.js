const { StatusCodes } = require('http-status-codes')
const CustomError = require('../errors')
const docusign = require('docusign-esign');
const fs = require('fs');
const SignType = require('../models/SignType')

const SCOPES = [
  "signature", "impersonation"
];

async function authenticate(dsApi){
  const jwtLifeSec = 10 * 60;
  dsApi.setOAuthBasePath(process.env.dsOauthServer.replace('https://', ''));
  let rsaKey = fs.readFileSync(process.env.privateKeyLocation);
  const results = await dsApi.requestJWTUserToken(process.env.dsJWTClientId,
    process.env.impersonatedUserGuid, SCOPES, rsaKey,
    jwtLifeSec);
  const accessToken = results.body.access_token;
  const userInfoResults = await dsApi.getUserInfo(accessToken);
  let userInfo = userInfoResults.accounts.find(account => account.isDefault === "true");
  return {
    accessToken: results.body.access_token,
    apiAccountId: userInfo.accountId,
    basePath: `${userInfo.baseUri}/restapi`
  };
}

async function makeEnvelope(request){
  let envelope = new docusign.EnvelopeDefinition();
  envelope.emailSubject = request.emailSubject;

  envelope.documents = [];
  let document = new docusign.Document();
  document.documentBase64 = request.document.body;
  document.name = request.document.name;
  const docNameParts = request.document.name.split('.');
  document.fileExtension = docNameParts.length > 1 ? 
                            docNameParts[docNameParts.length - 1] : 
                            "pdf";
  document.documentId = "1";
  envelope.documents.push(document);

  let _signers = [];
  let _ccs = [];

  let xPosition = 0;
  let i = 1;
  request.signers.forEach((_signer) => {
    let signer = docusign.Signer.constructFromObject({
      email: _signer.emailAddress,
      name: _signer.fullName,
      recipientId: (i).toString(),
      routingOrder:  (i).toString()
    });
    if(request.signType == SignType.OnTablet){
      signer.clientUserId = (i + 1000).toString();
    }
    
    let checkBoxTab1 = docusign.Checkbox.constructFromObject({
      tabLabel: "firstCheckBox",
      anchorString: "<< anchorString >>",
      anchorUnits: "pixels",
      anchorXOffset:"-27",
      anchorYOffset: "-4",
      anchorHorizontalAlignment: "left",
      shared: "false",
      locked: "false"
    });

    let checkBoxTab2 = docusign.Checkbox.constructFromObject({
      tabLabel: "secondCheckBox",
      anchorString: "<< anchorString >>" ,
      anchorUnits: "pixels",
      anchorXOffset:"-27",
      anchorYOffset: "-4",
      anchorHorizontalAlignment: "left",
      // shared: "false",
      // locked: "false",
      required: "false",
      selected: "false",
      tabGroupLabels: [ "CheckboxGroup1" ]
    });

    let checkBoxTab3 = docusign.Checkbox.constructFromObject({
      anchorIgnoreifNotPresent: "true",
      tabLabel: "thirdCheckBox",
      anchorString:  "<< anchorString >>",
      anchorUnits: "pixels",
      anchorXOffset:"-27",
      anchorYOffset: "-4",
      anchorHorizontalAlignment: "left",
      shared: "false",
      locked: "false"
    });

    let tabGroup1 = docusign.TabGroup.constructFromObject({ 
      groupLabel: "CheckboxGroup1",
      groupRule: "SelectAtLeast",
      // validationMessage: "Please check a box",
      minimumRequired: 1,
      maximumAllowed: 1,
      tabScope: "Document",
       locked: "false",
       documentId: "1",
       pageNumber: "1"
      //  recipientId: "1"
    });
   
    let signHere = docusign.SignHere.constructFromObject({
      //   xPosition: "275",
      //   yPosition: "550",
      //   width: "50",
      //   height: "14",
      //   name: "signHere",
      //   documentId: "1",
        tabLabel: "signHereTabLabel",
        anchorString:"<< anchorString >>",
        anchorUnits: "pixels",
        anchorXOffset: xPosition.toString(),
        anchorYOffset: "35",
        scaleValu: "1.5",
        name: "signature",
        optional: "false",
        conditionalParentLabel: "secondCheckBox",
        conditionalParentValue: "on"
    });
 
    let signer1Tabs = docusign.Tabs.constructFromObject({
      signHereTabs: [signHere],
      checkboxTab:  [checkBoxTab3, checkBoxTab2, checkBoxTab1],
      tabGroups: [ tabGroup1 ]
    });

    if(request.signType == SignType.OnTablet){
      let attachmetTab = docusign.SignerAttachment.constructFromObject({
        name: "attachment",
        xPosition: "25",
        yPosition: "775",
        width: "30",
        height: "830",
        documentId: "1",
        pageNumber: "1",
        optional: "true"
      });
      attachmetTab.conditionalParentLabel = "secondCheckBox";
      attachmetTab.conditionalParentValue = "on";
      signer1Tabs.signerAttachmentTabs = [attachmetTab]
    }

    xPosition += 130;
    ++i;
    signer.tabs = signer1Tabs;
    _signers.push(signer);
  });

  if(request.ccs && request.ccs.length){
    request.ccs.forEach((_cc) => {
      let cc = new docusign.CarbonCopy();
      cc.email = _cc.emailAddress;
      cc.name = _cc.fullName;
      cc.routingOrder = (i).toString();
      cc.recipientId = (i).toString();
      _ccs.push(cc);
      ++i;
    });
  }

  let recipients = docusign.Recipients.constructFromObject({
    signers: _signers,
    carbonCopies: _ccs
  });

  envelope.recipients = recipients;
  envelope.status = "sent";
  return envelope;
}

async function makeRecipientViewRequest(request, baseUrl){
  let viewRequest = new docusign.RecipientViewRequest();
  viewRequest.returnUrl = "http://" + baseUrl + "/result";
  viewRequest.authenticationMethod = 'email';
  viewRequest.email = request.signers[0].emailAddress;
  viewRequest.userName = request.signers[0].fullName;
  viewRequest.clientUserId = "1001";
  return viewRequest;
}

const createRecipientView = async (req, res) => {
  let dsApiClient = new docusign.ApiClient();
  let args = await authenticate(dsApiClient);
  dsApiClient.setBasePath(args.basePath);
  dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
  let viewRequest = new docusign.RecipientViewRequest();
  viewRequest.returnUrl = "http://" + req.headers.host + "/result";
  viewRequest.authenticationMethod = 'email';
  viewRequest.email = req.body.email;
  viewRequest.userName = req.body.userName;
  viewRequest.clientUserId = "1001";
  let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
  let viewResults = null;
  try {
    viewResults = await envelopesApi.createRecipientView(args.apiAccountId, req.body.envelopeId, {recipientViewRequest: viewRequest});
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json( { message: JSON.stringify(error.response.body.message)} );
  }
  res.status(StatusCodes.OK).json( { envelopeId: req.body.envelopeId, url: viewResults.url } );
};

const createEnvelope = async (req, res) => {
  let dsApi = new docusign.ApiClient();
  let args = await authenticate(dsApi);
  dsApi.setBasePath(args.basePath);
  dsApi.addDefaultHeader("Authorization", "Bearer " + args.accessToken);
  let envelopesApi = new docusign.EnvelopesApi(dsApi), envelopeResults = null;
  const envelope = await makeEnvelope(req.body);
   try {
    envelopeResults = await envelopesApi.createEnvelope(args.apiAccountId, {
      envelopeDefinition: envelope
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json( { message: JSON.stringify(error.response.body.message)} );
  }
  if(req.body.signType == SignType.ViaEmail){
    res.status(StatusCodes.OK).json( { envelopeId: envelopeResults.envelopeId } );
  }
  else if(req.body.signType == SignType.OnTablet){
    let viewRequest = await makeRecipientViewRequest(req.body, req.headers.host);
    let viewResults = null;
    try {
      viewResults = await envelopesApi.createRecipientView(args.apiAccountId, envelopeResults.envelopeId, {recipientViewRequest: viewRequest});
    } catch (error) {
      res.status(StatusCodes.BAD_REQUEST).json( { message: JSON.stringify(error.response.body.message)} );
    }
    res.status(StatusCodes.OK).json( { envelopeId: envelopeResults.envelopeId, url: viewResults.url } );
  }
  else{
    throw new CustomError.BadRequestError('Invalid sign type!');
  }
};

const getEnvelope = async (req, res) => {
  let dsApiClient = new docusign.ApiClient();
  let args = await authenticate(dsApiClient);
  dsApiClient.setBasePath(args.basePath);
  dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
  let envelopesApi = new docusign.EnvelopesApi(dsApiClient), result = null;
  result = await envelopesApi.getEnvelope(args.apiAccountId, req.params.envelopeId, null);
  res.status(StatusCodes.OK).json( { status: result.status  } );
};

const getDocument = async (req, res) => {
  let dsApiClient = new docusign.ApiClient();
  let args = await authenticate(dsApiClient);
  dsApiClient.setBasePath(args.basePath);
  dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + args.accessToken);
  let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
  const result = await envelopesApi.getDocument(args.apiAccountId, req.params.envelopeId, req.params.documentId, null);
  res.send( Buffer.from(result, 'binary') );
};

module.exports = {
  createEnvelope,
  getEnvelope,
  getDocument,
  createRecipientView
};