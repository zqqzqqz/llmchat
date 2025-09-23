请求：
curl --location --request GET 'http://localhost:3000/api/core/chat/init?appId=[appId]&chatId=[chatId]' \
--header 'Authorization: Bearer [apikey]'

参数：
appId：应用id
chatId：会话id


回复：
{
  "code": 200,
  "statusText": "",
  "message": "",
  "data": {
    "chatId": "sPVOuEohjo3w",
    "appId": "66e29b870b24ce35330c0f08",
    "variables": {},
    "app": {
      "chatConfig": {
        "questionGuide": true,
        "ttsConfig": {
          "type": "web"
        },
        "whisperConfig": {
          "open": false,
          "autoSend": false,
          "autoTTSResponse": false
        },
        "chatInputGuide": {
          "open": false,
          "textList": [],
          "customUrl": ""
        },
        "instruction": "",
        "variables": [],
        "fileSelectConfig": {
          "canSelectFile": true,
          "canSelectImg": true,
          "maxFiles": 10
        },
        "_id": "66f1139aaab9ddaf1b5c596d",
        "welcomeText": ""
      },
      "chatModels": ["GPT-4o-mini"],
      "name": "测试",
      "avatar": "/imgs/app/avatar/workflow.svg",
      "intro": "",
      "type": "advanced",
      "pluginInputs": []
    }
  }
}