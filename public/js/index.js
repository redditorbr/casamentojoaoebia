import { validateEmail, validateGift } from "./validation.js"
import { formatCurrency } from "./currency.js"

/* ---------- COUNTDOWN ---------- */
const weddingDate = new Date('2026-11-22T15:00:00-03:00');

function pad(n){
   return String(n).padStart(2, '0')
}

function updateCountdown(){
   const now = new Date();
   let diff = weddingDate - now;

   if (diff <= 0) {
   document.getElementById('cd-days').textContent = '00';
   document.getElementById('cd-hours').textContent = '00';
   document.getElementById('cd-mins').textContent = '00';
   document.getElementById('cd-secs').textContent = '00';
   return;
   }

   const days = Math.floor(diff / 86400000);
   const hours = Math.floor((diff % 86400000) / 3600000);
   const mins = Math.floor((diff % 3600000) / 60000);
   const secs = Math.floor((diff % 60000) / 1000);

   document.getElementById('cd-days').textContent = pad(days);
   document.getElementById('cd-hours').textContent = pad(hours);
   document.getElementById('cd-mins').textContent = pad(mins);
   document.getElementById('cd-secs').textContent = pad(secs);
}
updateCountdown();

setInterval(updateCountdown, 1000);

const giftPrices = document.querySelectorAll(".gift-prices li button")
const giftPanel = document.querySelector(".gift-panel")
const emailForm = document.querySelector(".email-step")
const userEmail = emailForm.querySelector("#email")

let selectedGift = {value: null, phrase: null}

// Seleciona a opção do presente na tela e guarda o valor e frase escolhidos
function selectGiftOption(button) {
   giftPrices.forEach(otherButton => otherButton.classList.remove("selected"))
   button.classList.add("selected")
   selectedGift = {value: button.dataset.value, phrase: button.dataset.phrase}
}

// Abre o painel do presente, com informações sobre pagamento
function openGiftPanel() {
   giftPanel.classList.add("open")
   giftPanel.scrollIntoView({behavior: "smooth", block: "nearest"});
}

giftPrices.forEach(button => {
   button.addEventListener("click", () => {
      selectGiftOption(button)
      openGiftPanel()

      // Se o email já tiver preenchido e a pessoa trocar o valor, gera um novo pix com aquele valor
      if (validateEmail(userEmail.value)) requestPaymentInfo(selectedGift, userEmail.value)
   })
})

const giftPanelSlider = giftPanel.querySelector(".gift-panel-inner .gift-panel-slider")
const paymentStep = giftPanelSlider.querySelector(".payment-step")
const giftSteps = giftPanel.querySelector(".gift-steps")
const stepReturnBtn = paymentStep.querySelector(".return-btn")
const userMessage = paymentStep.querySelector("#message")
const pixKeyText = paymentStep.querySelector("#pixKeyText")
const copyKeyBtn = paymentStep.querySelector(".pix-row button")
const toastMessage = document.querySelector(".toast-message")
const toastCloseBtn = toastMessage.querySelector("button")
const whatsappBtn = paymentStep.querySelector("#waBtn")

let toastTimer = null
let nextToast = null
let isToastActive = false

// Verifica se o painel está na primeira etapa (email)
function isFirstStep() {
   return paymentStep.style.height !== "auto"
}

// Move o painel de presente para a etapa anterior ou próxima (email ou pagamento)
function selectPanelStep() {
   const firstStep = isFirstStep()

   paymentStep.style.height = firstStep ? "auto" : "0"
   giftPanelSlider.style.transform = `translateX(${firstStep ? `calc(-100% - ${getComputedStyle(giftPanelSlider.parentElement).paddingLeft})` : "0"})`
   giftSteps.firstElementChild.className = isFirstStep() ? "active" : ""
   giftSteps.lastElementChild.className = isFirstStep() ? "" : "active"
}

// Mostra a notificação toast com mensagem e status de sucesso/erro
async function showToast(message, status) {
   if (isToastActive) {
      nextToast = {message, status}
      return
   }

   const toastText = toastMessage.querySelector(".toast-info p")

   clearTimeout(toastTimer)

   if (toastMessage.classList.contains("show")) {
      isToastActive = true
      toastMessage.className = `toast-message hide ${status}`

      await new Promise(resolve => toastMessage.addEventListener("animationend", resolve, {once: true}))

      toastMessage.classList.remove("hide")
      isToastActive = false

      if (nextToast) {
         showToast(nextToast.message, nextToast.status)
         nextToast = null
         return
      }
   }

   toastText.textContent = message
   toastMessage.className = `toast-message show ${status}`

   toastTimer = setTimeout(() => toastMessage.className = `toast-message ${status}`, 7 * 1000)
}

// Atualiza o estado atual da chave pix (carregando/sucesso/erro), mostrando as mensagens e bloqueando/ativando os botões
function setPixKeyState(status, text) {
   const isDisabled = status === "loading" || status === "error"

   pixKeyText.textContent = text
   pixKeyText.className = isDisabled ? "disabled" : ""
   copyKeyBtn.className = status === "loading" ? "btn disabled" : "btn"
   copyKeyBtn.disabled = status === "loading"
   copyKeyBtn.textContent = status === "error" ? "Gerar chave" : "Copiar chave Pix"
}

// Copia a chave pix gerada
async function copyPixKey() {
   if (copyKeyBtn.textContent !== "Copiar chave Pix") return

   try {
      await navigator.clipboard.writeText(pixKeyText.textContent.trim())
      showToast("Chave pix copiada com sucesso", "success")
   } catch (error) {
      showToast("Ocorreu um erro ao tentar copiar o texto, tente novamente", "error")
   }
}

// Busca as informações de pagamento, retornando a chave pix e qr code, e enviando o email e valor escolhido pelo usuário
async function requestPaymentInfo(gift, email) {
   try {
      if (!validateGift(gift.value, gift.phrase)) return showToast("Selecione um presente válido", "error")

      setPixKeyState("loading", "Gerando chave pix...")

      const response = await fetch("/api/payments/pix", {
         method: "POST",
         headers: {"Content-Type": "application/json"},
         body: JSON.stringify({
            email: email,
            amount: gift.value,
            phrase: gift.phrase,
            message: userMessage.value.trim()
         })
      })

      const data = await response.json()

      if (!response.ok) {
         showToast(data.error, "error")
         pixKeyText.textContent = "Falha ao gerar a chave pix"
         return
      }

      const pixKey = data.point_of_interaction.transaction_data.qr_code
      
      setPixKeyState("success", pixKey)
   } catch (error) {
      setPixKeyState("error", "Falha ao gerar a chave pix")
      showToast("Não foi possível conectar ao servidor, tente novamente mais tarde", "error")
   }
}

// Detectar clique no botão de "X" do toast
toastCloseBtn.addEventListener("click", () => {
   toastMessage.classList.remove("show")
   toastMessage.classList.add("hide")
})

// Detectar envio do email do usuário no botão "continuar"
emailForm.addEventListener("submit", (e) => {
   e.preventDefault()

   if (!validateEmail(userEmail.value)) return showToast("Digite um email válido", "error")

   selectPanelStep()
   requestPaymentInfo(selectedGift, userEmail.value)
})

// Detectar clique no botão "voltar" do painel de pagamento
stepReturnBtn.addEventListener("click", () => {
   selectPanelStep()
})

// Detectar clique na área da chave pix, para copiar
pixKeyText.addEventListener("click", copyPixKey)

// Detectar clique no botão da chave pix, para copiar ou tentar gerar uma nova chave em caso de erro
copyKeyBtn.addEventListener("click", () => {
   if (copyKeyBtn.textContent === "Gerar chave") {
      requestPaymentInfo(selectedGift, userEmail.value)
      return
   }

   copyPixKey()
})

const PHONE_NUMBER = "5545998481037"

// Detectar clique no botão de "enviar mensagem no whatsapp"
whatsappBtn.addEventListener("click", () => {
   if (!validateGift(selectedGift.value, selectedGift.phrase)) return showToast("Selecione um presente válido", "error")

   // Precisa manter a mensagem assim pra não ter espaços indesejados no começo de cada linha
   const message = `
Oi, Bia e João! ❤️

Acabei de enviar um presentinho para vocês!

🎁 Presente: ${formatCurrency(selectedGift.value)} (${selectedGift.phrase.trim()})
${userMessage.value.trim() ? `💌 Mensagem: ${userMessage.value.trim()}` : ""}
   `

   window.open(`https://api.whatsapp.com/send?phone=${PHONE_NUMBER}&text=${encodeURIComponent(message.trim())}`, "_blank")
})