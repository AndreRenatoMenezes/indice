package dev.indice.app.ui.finance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dev.indice.app.data.api.CreateTransactionRequest
import dev.indice.app.ui.common.ChipRow
import dev.indice.app.ui.common.DropdownField
import dev.indice.app.ui.common.Fmt
import dev.indice.app.ui.common.Tones

private val TYPES = listOf("EXPENSE" to "Saída", "INCOME" to "Entrada", "INVESTMENT" to "Aporte")
private val PAYMENTS = listOf("PIX" to "Pix", "DEBIT" to "Débito", "CREDIT" to "Crédito", "CASH" to "Dinheiro")

/** Lançamento rápido (design "Lancar"): tipo, valor, descrição, forma, conta/cartão e categoria. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickEntrySheet(d: FinanceData, onDismiss: () -> Unit, onSubmit: (CreateTransactionRequest) -> Unit) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var type by remember { mutableStateOf("EXPENSE") }
    var amount by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var payment by remember { mutableStateOf("PIX") }
    var accountId by remember { mutableStateOf(d.accounts.firstOrNull { it.isDefault }?.id ?: d.accounts.firstOrNull()?.id) }
    var cardId by remember { mutableStateOf(d.cards.firstOrNull()?.first) }
    var categoryId by remember { mutableStateOf<String?>(null) }
    val today = Fmt.today()
    val parsed = Fmt.parseAmount(amount)
    val credit = type == "EXPENSE" && payment == "CREDIT"
    val categories = d.categories.filter { it.kind == type && !it.system }.map { it.id to it.name }
    val valid = parsed != null && (!credit || cardId != null)
    val verb = when (type) { "INCOME" -> "entrada"; "INVESTMENT" -> "aporte"; else -> "saída" }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                Text("Lançamento rápido", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text("Hoje · ${Fmt.shortDate(today)}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                TYPES.forEachIndexed { i, (id, label) ->
                    SegmentedButton(selected = type == id, onClick = { type = id; categoryId = null; if (id != "EXPENSE" && payment == "CREDIT") payment = "PIX" }, shape = SegmentedButtonDefaults.itemShape(i, TYPES.size)) { Text(label) }
                }
            }
            OutlinedTextField(
                value = amount, onValueChange = { amount = it }, modifier = Modifier.fillMaxWidth(), label = { Text("Valor") }, prefix = { Text("R$ ") },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), textStyle = MaterialTheme.typography.headlineSmall,
            )
            OutlinedTextField(description, { description = it }, Modifier.fillMaxWidth(), label = { Text("Descrição") }, singleLine = true)
            if (type == "EXPENSE") ChipRow(PAYMENTS, payment) { payment = it }
            if (credit) DropdownField("Cartão", d.cards, cardId, { cardId = it })
            else DropdownField("Conta", d.accounts.map { it.id to it.name }, accountId, { accountId = it }, noneLabel = "não informada")
            DropdownField("Categoria", categories, categoryId, { categoryId = it }, noneLabel = "sem categoria")
            Spacer(Modifier.height(4.dp))
            Button(
                onClick = {
                    onSubmit(CreateTransactionRequest(
                        type = type, date = today, amount = parsed ?: 0.0, description = description.trim(), categoryId = categoryId,
                        paymentMethod = if (type == "EXPENSE") payment else "PIX", accountId = if (credit) null else accountId, creditCardId = if (credit) cardId else null,
                    ))
                },
                enabled = valid, modifier = Modifier.fillMaxWidth().height(50.dp), colors = ButtonDefaults.buttonColors(containerColor = Tones.green),
            ) { Text(if (parsed != null) "Lançar $verb de ${Fmt.brl(parsed)}" else "Lançar $verb", color = androidx.compose.ui.graphics.Color.Black) }
        }
    }
}
