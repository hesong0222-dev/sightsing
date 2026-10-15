<p align="center"><img src="mascot.png" width="140"></p>

# 초견 노래방 (sightsing)

악보가 흘러가면 **보고 바로 불러보는** 초견 노래 게임. 마이크로 음마다 맞았는지 판정함.

👉 **바로 하기: https://hesong0222-dev.github.io/sightsing/**

- 레벨 1 "도레미"부터 레벨 8 "지옥"(도약·8분음표·임시표·빠른 템포)까지
- 시작 전에 "도" 음 들려주고 4박 셈
- 맞은 음은 초록, 틀린 음은 빨강. 내가 부른 음높이가 주황 선으로 그려짐 (삑사리가 다 보임)
- 옥타브 상관없음. 남자든 여자든 편한 높이로
- 별 1개 이상이면 다음 레벨 열림

## 개인정보

마이크 소리는 내 브라우저 안에서만 분석함. 녹음 안 하고 어디로도 안 보냄. 서버 없음.

## 직접 돌리기

파일 두 개짜리 정적 웹앱이라 아무 웹서버로 열면 됨.

```bash
git clone https://github.com/hesong0222-dev/sightsing && cd sightsing && python3 -m http.server
```

`?test=1`을 붙이면 마이크 대신 정확히 부르는 가상 목소리로 돌아감 (`?test=bad`는 일부러 틀림).

---

MIT · 만든 사람 [개발새발자](https://x.com/ComAsNas) · 아이디어: 리듬 초견 게임 릴스 보고 "노래 버전 있으면 좋겠다" 해서
